import "server-only";
import ExcelJS from "exceljs";
import type { CustomerType, ListingPurpose } from "@/generated/prisma/enums";
import { invalid } from "@/lib/errors";
import { phone as phoneRule } from "@/schemas/common";

/**
 * Reads a leads-pool spreadsheet (.xlsx or .csv). Columns are recognised by their heading, in
 * English or Arabic — "Phone / Mobile / Number / رقم", "Name / الاسم", "Area / Location", "Type",
 * "Rent or sale", "Bedrooms", "Budget", "Notes"… Only the phone column is needed; any other
 * column with a value is kept in the notes ("Nationality: Egyptian"), so nothing is lost.
 * Without a heading row, the column that looks like phone numbers is used.
 */

export const POOL_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export interface PoolSheetRow {
  /** Row number in the file (for the "not added" list). */
  line: number;
  phone: string;
  fullName: string | null;
  email: string | null;
  leadType: CustomerType | null;
  purpose: ListingPurpose | null;
  interestedArea: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  bedrooms: number | null;
  notes: string | null;
}

type Field = "phone" | "fullName" | "email" | "leadType" | "purpose" | "interestedArea" | "bedrooms" | "budget" | "budgetMin" | "budgetMax" | "notes";

/** Heading words → field (compared lower-case, without punctuation). */
const HEADINGS: [Field, RegExp][] = [
  ["budgetMin", /^(min(imum)? ?(budget|price)|budget ?(min|from)|price ?from|الميزانية من)$/],
  ["budgetMax", /^(max(imum)? ?(budget|price)|budget ?(max|to)|price ?to|الميزانية الى|الميزانية إلى)$/],
  ["bedrooms", /(bed ?rooms?|^beds?$|^br$|rooms|غرف)/],
  ["phone", /(phone|mobile|mob|cell|tel|telephone|number|contact ?no|whatsapp|whats app|رقم|هاتف|جوال|موبايل|واتس)/],
  ["email", /(e ?mail|بريد|ايميل|إيميل)/],
  ["fullName", /^(name|full ?name|client( ?name)?|customer( ?name)?|owner( ?name)?|contact( ?name)?|lead( ?name)?|الاسم|اسم|العميل|المالك)$/],
  ["leadType", /^(type|lead ?type|client ?type|customer ?type|category|role|النوع|الفئة)$/],
  ["purpose", /^(purpose|for|rent ?(or|\/)? ?sale|sale ?(or|\/)? ?rent|transaction|deal ?type|الغرض|بيع ?او ?ايجار|ايجار ?او ?بيع)$/],
  ["interestedArea", /^(area|location|community|district|zone|preferred ?area|city|المنطقة|الموقع|الحي)$/],
  ["budget", /^(budget|price|amount|الميزانية|السعر)$/],
  ["notes", /^(notes?|comments?|remarks?|requirements?|needs?|details?|description|ملاحظات|ملاحظة|المتطلبات)$/],
];

const TYPE_WORDS: [CustomerType, RegExp][] = [
  ["BUYER", /buyer|buy|مشتري/i],
  ["TENANT", /tenant|renter|مستأجر/i],
  ["INVESTOR", /investor|مستثمر/i],
  ["LANDLORD", /landlord|owner ?\(rent\)|مؤجر/i],
  ["SELLER", /seller|sell|بائع/i],
];

const clean = (v: string) => v.replace(/\s+/g, " ").trim();
const key = (v: string) => clean(v).toLowerCase().replace(/[^\p{L}\p{N}/ ]/gu, " ").replace(/\s+/g, " ").trim();

function fieldFor(heading: string): Field | null {
  const k = key(heading);
  if (!k) return null;
  for (const [field, re] of HEADINGS) if (re.test(k)) return field;
  return null;
}

function money(v: string) {
  const m = v.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m|mn|million|thousand)?/i);
  if (!m) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const n = Number(m[1]) * (unit.startsWith("m") ? 1_000_000 : unit === "k" || unit === "thousand" ? 1000 : 1);
  return Number.isFinite(n) && n <= 10_000_000_000 ? Math.round(n) : null;
}

/** "1.5M – 2M", "8,000 - 10,000", "≤ 12000" → min / max */
function budgetRange(v: string): [number | null, number | null] {
  const parts = v.split(/\s*(?:-|–|—|to|إلى|الى)\s*/i).filter(Boolean);
  if (parts.length >= 2) return [money(parts[0]), money(parts[1])];
  return [null, money(v)];
}

function purposeOf(v: string): ListingPurpose | null {
  if (/rent|lease|ايجار|إيجار|تأجير/i.test(v)) return "RENT";
  if (/sale|sell|buy|بيع|شراء/i.test(v)) return "SALE";
  return null;
}

/** Phone cells: numbers stored as numbers lose their "+", spaces and leading zeros. */
function phoneOf(v: string) {
  const t = clean(v).replace(/^tel:/i, "").replace(/^00/, "+");
  return t;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "yes" : "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("hyperlink" in value) return String((value as { text?: unknown }).text ?? value.hyperlink);
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return "";
}

/** Minimal CSV reader (quotes, commas or semicolons, CRLF). */
function parseCsv(text: string): string[][] {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) > (text.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter || c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function readGrid(file: File): Promise<string[][]> {
  if (file.size > POOL_IMPORT_MAX_BYTES) throw invalid("The file is too large (10 MB max).", { file: ["Too large"] });
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    return parseCsv(buffer.toString("utf8").replace(/^﻿/, ""));
  }
  if (name.endsWith(".xls")) throw invalid("Old .xls files aren't supported — in Excel use File › Save As › Excel Workbook (.xlsx) or CSV.", { file: ["Save as .xlsx"] });
  // .xlsx files are zip archives ("PK").
  if (!name.endsWith(".xlsx") || buffer.subarray(0, 2).toString("latin1") !== "PK") {
    throw invalid("Choose an Excel (.xlsx) or CSV file.", { file: ["Unsupported file"] });
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw invalid("This Excel file couldn't be read — save it again as .xlsx or CSV and retry.", { file: ["Unreadable"] });
  }
  // The first sheet that has data.
  const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) return [];
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, n) => {
    const values: string[] = [];
    for (let c = 1; c <= Math.min(row.cellCount, 60); c++) values.push(cellText(row.getCell(c).value));
    grid[n - 1] = values;
  });
  return Array.from(grid, (r) => r ?? []);
}

const looksLikePhone = (v: string) => /[0-9]/.test(v) && phoneRule.safeParse(phoneOf(v)).success;

export async function readPoolSheet(file: File) {
  const grid = (await readGrid(file)).map((r) => r.map((c) => clean(c ?? "")));
  const width = Math.max(0, ...grid.map((r) => r.length));

  // The heading row: the first of the first 10 rows that names a phone column.
  let headerIndex = -1;
  let fields: (Field | null)[] = [];
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const candidate = grid[i].map(fieldFor);
    if (candidate.includes("phone") && !grid[i].some(looksLikePhone)) {
      headerIndex = i;
      fields = candidate;
      break;
    }
  }
  const headings = headerIndex >= 0 ? grid[headerIndex] : [];
  if (headerIndex < 0) {
    // No headings: the column where most cells look like phone numbers; the first text column is the name.
    const scores = Array.from({ length: width }, (_, c) => grid.filter((r) => looksLikePhone(r[c] ?? "")).length);
    const phoneCol = scores.indexOf(Math.max(...scores, 0));
    if (width === 0 || scores[phoneCol] === 0) throw invalid("No phone numbers found. Put the numbers in a column headed “Phone”.", { file: ["No phone column"] });
    fields = Array.from({ length: width }, (_, c) => (c === phoneCol ? "phone" : null));
    const nameCol = fields.findIndex((f, c) => f === null && grid.some((r) => /\p{L}/u.test(r[c] ?? "")));
    if (nameCol >= 0) fields[nameCol] = "fullName";
  } else {
    // Only the first column of each kind counts; a second "phone" column goes to the notes.
    const seen = new Set<Field>();
    fields = fields.map((f) => (f && !seen.has(f) ? (seen.add(f), f) : null));
  }
  const phoneCol = fields.indexOf("phone");
  const columns = fields.map((f, c) => ({ heading: headings[c] || `Column ${c + 1}`, field: f })).filter((c) => c.field || headings.length);

  const rows: PoolSheetRow[] = [];
  const skipped: { line: number; text: string; reason: string }[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i];
    if (!cells.some(Boolean)) continue;
    const line = i + 1;
    const raw = cells[phoneCol] ?? "";
    // A cell may hold two numbers ("5512 3456 / 6612 7788") — the first one is used.
    const first = raw.split(/\s*(?:\/|,|;|\bor\b|\|)\s*/)[0] ?? "";
    const phone = phoneOf(first);
    if (!phone || !phoneRule.safeParse(phone).success) {
      skipped.push({ line, text: (raw || cells.filter(Boolean).join(" · ")).slice(0, 80), reason: raw ? "Not a valid phone number" : "No phone number" });
      continue;
    }
    const row: PoolSheetRow = { line, phone, fullName: null, email: null, leadType: null, purpose: null, interestedArea: null, budgetMin: null, budgetMax: null, bedrooms: null, notes: null };
    const extra: string[] = [];
    if (raw !== first) extra.push(`Other number: ${raw.slice(first.length).replace(/^\s*[/,;|]\s*|^\s*or\s*/i, "")}`);
    cells.forEach((value, c) => {
      if (!value || c === phoneCol) return;
      switch (fields[c]) {
        case "fullName":
          row.fullName = value.slice(0, 120);
          break;
        case "email":
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) row.email = value.toLowerCase().slice(0, 160);
          else extra.push(`${headings[c]}: ${value}`);
          break;
        case "leadType": {
          const t = TYPE_WORDS.find(([, re]) => re.test(value))?.[0] ?? null;
          row.leadType = t;
          if (!t) extra.push(`${headings[c]}: ${value}`);
          if (!row.purpose) row.purpose = purposeOf(value);
          break;
        }
        case "purpose":
          row.purpose = purposeOf(value);
          if (!row.purpose) extra.push(`${headings[c]}: ${value}`);
          break;
        case "interestedArea":
          row.interestedArea = value.slice(0, 120);
          break;
        case "bedrooms": {
          const n = /studio/i.test(value) ? 0 : Number(value.match(/\d+/)?.[0]);
          if (Number.isInteger(n) && n >= 0 && n <= 20) row.bedrooms = n;
          else extra.push(`${headings[c]}: ${value}`);
          break;
        }
        case "budget":
          [row.budgetMin, row.budgetMax] = budgetRange(value);
          break;
        case "budgetMin":
          row.budgetMin = money(value);
          break;
        case "budgetMax":
          row.budgetMax = money(value);
          break;
        case "notes":
          extra.unshift(value);
          break;
        default:
          extra.push(headings.length ? `${headings[c] || `Column ${c + 1}`}: ${value}` : value);
      }
    });
    if (row.budgetMin != null && row.budgetMax != null && row.budgetMin > row.budgetMax) [row.budgetMin, row.budgetMax] = [row.budgetMax, row.budgetMin];
    row.notes = extra.length ? extra.join(" · ").slice(0, 2000) : null;
    rows.push(row);
  }
  return { rows, skipped, columns };
}
