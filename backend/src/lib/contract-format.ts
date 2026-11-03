/**
 * Contract templates: placeholder list, filling and safe rendering. Client-safe (the template
 * editor previews with the same code the server uses to generate contracts).
 *
 * Template syntax (plain text):
 *   # Title / ## Section heading
 *   **bold**
 *   - bullet item
 *   blank line = new paragraph
 *   {{placeholder}} = value from the deal or a field the agent fills in
 *   ---  = horizontal rule
 */

export interface ContractField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "money";
  required: boolean;
}

/** Filled automatically from the deal, its parties, the property and the agent. */
export const AUTO_PLACEHOLDERS: { key: string; label: string; sample: string }[] = [
  { key: "today", label: "Today's date", sample: "14 October 2026" },
  { key: "company_name", label: "Company name", sample: "ELITE Real Estate" },
  { key: "deal_reference", label: "Deal reference", sample: "DL-1012" },
  { key: "deal_type", label: "Sale / Rental", sample: "Sale" },
  { key: "deal_amount", label: "Agreed amount", sample: "QAR 2,450,000" },
  { key: "deal_amount_words", label: "Agreed amount in words", sample: "Two million four hundred fifty thousand Qatari Riyals" },
  { key: "commission_percent", label: "Commission %", sample: "2%" },
  { key: "commission_amount", label: "Commission amount", sample: "QAR 49,000" },
  { key: "client_name", label: "Client / buyer / tenant name", sample: "Omar Rahman" },
  { key: "client_phone", label: "Client phone", sample: "+974 5512 3456" },
  { key: "client_email", label: "Client e-mail", sample: "omar@example.com" },
  { key: "client_nationality", label: "Client nationality", sample: "Qatari" },
  { key: "client_id_number", label: "Client QID / passport number", sample: "28463400000" },
  { key: "owner_name", label: "Owner / seller / landlord name", sample: "Khalid Al-Thani" },
  { key: "owner_phone", label: "Owner phone", sample: "+974 5500 1234" },
  { key: "property_reference", label: "Property reference", sample: "ELT-1004" },
  { key: "property_title", label: "Property title", sample: "Sea-view 3BR apartment" },
  { key: "property_type", label: "Property type", sample: "Apartment" },
  { key: "property_address", label: "Property address", sample: "Tower 12, Porto Arabia, The Pearl, Doha" },
  { key: "property_size", label: "Size (m²)", sample: "210 m²" },
  { key: "property_bedrooms", label: "Bedrooms", sample: "3" },
  { key: "agent_name", label: "Agent name", sample: "Aisha Rahman" },
  { key: "agent_phone", label: "Agent phone", sample: "+974 5500 3002" },
  { key: "agent_email", label: "Agent e-mail", sample: "aisha@elite.qa" },
];

export const AUTO_KEYS = new Set(AUTO_PLACEHOLDERS.map((p) => p.key));
export const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export function placeholdersIn(body: string) {
  return [...new Set([...body.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
}

/** Replaces {{keys}}; missing values become a blank line to fill in by hand. */
export function fillPlaceholders(body: string, values: Record<string, string | null | undefined>) {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => {
    const v = values[key];
    return v != null && String(v).trim() !== "" ? String(v) : "________________";
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(s: string) {
  // Escape first, then add the only markup we allow.
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(_{6,})/g, '<span class="blank">$1</span>');
}

/** Text → HTML. Everything is escaped; only headings, bold, lists, rules and paragraphs. */
export function renderContractHtml(text: string) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.trim() !== "");
      if (!lines.length) return "";
      if (lines.length === 1 && /^-{3,}$/.test(lines[0].trim())) return "<hr>";
      if (lines.length === 1 && lines[0].startsWith("# ")) return `<h1>${inline(lines[0].slice(2))}</h1>`;
      if (lines.length === 1 && lines[0].startsWith("## ")) return `<h2>${inline(lines[0].slice(3))}</h2>`;
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
      const out: string[] = [];
      let para: string[] = [];
      const flush = () => {
        if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
        para = [];
      };
      for (const line of lines) {
        if (line.startsWith("## ")) {
          flush();
          out.push(`<h2>${inline(line.slice(3))}</h2>`);
        } else if (line.startsWith("# ")) {
          flush();
          out.push(`<h1>${inline(line.slice(2))}</h1>`);
        } else para.push(line);
      }
      flush();
      return out.join("");
    })
    .join("\n");
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`);
  return parts.join(" ");
}

/** 2450000 → "Two million four hundred fifty thousand". */
export function numberToWords(value: number) {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const scales = ["", "thousand", "million", "billion"];
  const parts: string[] = [];
  for (let i = 0; n > 0 && i < scales.length; i++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${under1000(chunk)}${scales[i] ? ` ${scales[i]}` : ""}`);
  }
  const words = parts.join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
