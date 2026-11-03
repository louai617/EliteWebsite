import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { can, scope, type Actor } from "@/lib/permissions";
import { PROPERTY_TYPE_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { fillPlaceholders, numberToWords, type ContractField } from "@/lib/contract-format";
import type { contractTemplateSchema, generateContractSchema } from "@/schemas/contract";
import { logActivity } from "./activity";
import { DEFAULT_TEMPLATES } from "./contract-defaults";
import { nextReference } from "./references";

/**
 * Contracts: the admin maintains drafts (templates with {{placeholders}}); agents pick a
 * template on a deal, fill in the few fields it asks for, and get a contract filled with the
 * deal, parties, property and agent details. Generated contracts are frozen snapshots.
 */

export function parseFields(json: string): ContractField[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? (value as ContractField[]) : [];
  } catch {
    return [];
  }
}

/** Creates the starting drafts once, so a fresh install has something to edit. */
async function ensureDefaults() {
  if (await db.contractTemplate.count()) return;
  await db.contractTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({ name: t.name, description: t.description, dealType: t.dealType, body: t.body, fields: JSON.stringify(t.fields) })),
  });
}

export async function listTemplates({ activeOnly = false } = {}) {
  await ensureDefaults();
  const rows = await db.contractTemplate.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, dealType: true, body: true, fields: true, isActive: true, version: true, updatedAt: true, updatedBy: { select: { name: true } }, _count: { select: { contracts: true } } },
  });
  return rows.map((r) => ({ ...r, fields: parseFields(r.fields) }));
}

export type TemplateItem = Awaited<ReturnType<typeof listTemplates>>[number];

export async function getTemplate(id: string) {
  const t = await db.contractTemplate.findUnique({ where: { id } });
  return t ? { ...t, fields: parseFields(t.fields) } : null;
}

export async function saveTemplate(actor: Actor, input: z.output<typeof contractTemplateSchema>) {
  if (!can.editSettings(actor)) throw forbidden("Only admins can edit contract templates.");
  const data = { name: input.name, description: input.description, dealType: input.dealType, body: input.body, fields: JSON.stringify(input.fields), isActive: input.isActive, updatedById: actor.id };
  if (input.id) {
    const current = await db.contractTemplate.findUnique({ where: { id: input.id }, select: { id: true, body: true, fields: true } });
    if (!current) throw notFound("Template");
    const changed = current.body !== data.body || current.fields !== data.fields;
    return db.contractTemplate.update({ where: { id: input.id }, data: { ...data, ...(changed ? { version: { increment: 1 } } : {}) }, select: { id: true, name: true, version: true } });
  }
  return db.contractTemplate.create({ data, select: { id: true, name: true, version: true } });
}

/** Templates with contracts are deactivated, not deleted, so generated contracts keep their source. */
export async function deleteTemplate(actor: Actor, id: string) {
  if (!can.editSettings(actor)) throw forbidden("Only admins can edit contract templates.");
  const t = await db.contractTemplate.findUnique({ where: { id }, select: { _count: { select: { contracts: true } } } });
  if (!t) throw notFound("Template");
  if (t._count.contracts) {
    await db.contractTemplate.update({ where: { id }, data: { isActive: false, updatedById: actor.id } });
    return { deactivated: true };
  }
  await db.contractTemplate.delete({ where: { id } });
  return { deactivated: false };
}

// ───────────────────────────── Generation ─────────────────────────────

async function scopedDealForContract(actor: Actor, dealId: string) {
  const deal = await db.deal.findFirst({
    where: { id: dealId, ...scope.deals(actor) },
    select: {
      id: true, reference: true, type: true, status: true, amount: true, commissionPercent: true, commissionAmount: true,
      client: { select: { id: true, fullName: true, phone: true, email: true, nationality: true, idReference: true } },
      lead: { select: { id: true, fullName: true, phone: true, email: true, nationality: true } },
      owner: { select: { fullName: true, phone: true } },
      agent: { select: { name: true, phone: true, email: true } },
      property: { select: { reference: true, title: true, type: true, buildingName: true, street: true, area: true, city: true, areaSqm: true, bedrooms: true } },
    },
  });
  if (!deal) throw notFound("Deal");
  return deal;
}

/** Values filled automatically for a deal (shown read-only when generating). */
export async function autoValues(actor: Actor, dealId: string) {
  const deal = await scopedDealForContract(actor, dealId);
  const party = deal.client ?? deal.lead;
  const idDoc = await db.document.findFirst({
    where: { kind: { in: ["QID", "PASSPORT"] }, number: { not: null }, OR: [...(deal.client ? [{ clientId: deal.client.id }] : []), ...(deal.lead ? [{ leadId: deal.lead.id }] : [])] },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
    select: { number: true },
  });
  const cfg = await db.settings.findUnique({ where: { id: "default" }, select: { companyName: true } });
  const p = deal.property;
  const values: Record<string, string> = {
    today: formatDate(new Date()),
    company_name: cfg?.companyName ?? "ELITE Real Estate",
    deal_reference: deal.reference,
    deal_type: deal.type === "SALE" ? "Sale" : "Rental",
    deal_amount: formatMoney(deal.amount),
    deal_amount_words: `${numberToWords(deal.amount)} Qatari Riyals`,
    commission_percent: `${deal.commissionPercent}%`,
    commission_amount: formatMoney(deal.commissionAmount),
    client_name: party?.fullName ?? "",
    client_phone: party?.phone ?? "",
    client_email: party?.email ?? "",
    client_nationality: party?.nationality ?? "",
    client_id_number: idDoc?.number ?? deal.client?.idReference ?? "",
    owner_name: deal.owner?.fullName ?? "",
    owner_phone: deal.owner?.phone ?? "",
    property_reference: p.reference,
    property_title: p.title,
    property_type: PROPERTY_TYPE_META[p.type].label,
    property_address: [p.buildingName, p.street, p.area, p.city].filter(Boolean).join(", "),
    property_size: p.areaSqm ? `${p.areaSqm} m²` : "",
    property_bedrooms: p.bedrooms == null ? "" : p.bedrooms === 0 ? "Studio" : String(p.bedrooms),
    agent_name: deal.agent?.name ?? "",
    agent_phone: deal.agent?.phone ?? "",
    agent_email: deal.agent?.email ?? "",
  };
  return { deal, values };
}

function formatField(field: ContractField, raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (field.type === "date") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : formatDate(d);
  }
  if (field.type === "money") {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n.toLocaleString("en-US") : value;
  }
  return value;
}

export async function generateContract(actor: Actor, input: z.output<typeof generateContractSchema>) {
  const { deal, values: auto } = await autoValues(actor, input.dealId);
  if (deal.status === "CANCELLED") throw conflict("This deal was cancelled — contracts can't be generated for it.");
  const template = await getTemplate(input.templateId);
  if (!template || !template.isActive) throw notFound("Contract template");
  if (template.dealType && template.dealType !== deal.type) throw invalid(`“${template.name}” is for ${template.dealType === "SALE" ? "sales" : "rentals"}.`, { templateId: ["Wrong deal type"] });

  const fieldErrors: Record<string, string[]> = {};
  const custom: Record<string, string> = {};
  for (const field of template.fields) {
    const raw = input.values[field.key] ?? "";
    if (field.required && !raw.trim()) fieldErrors[`values.${field.key}`] = [`${field.label} is required`];
    if (field.type === "number" || field.type === "money") {
      if (raw.trim() && !Number.isFinite(Number(raw.replace(/[, ]/g, "")))) fieldErrors[`values.${field.key}`] = ["Enter a number"];
    }
    custom[field.key] = formatField(field, raw);
  }
  if (Object.keys(fieldErrors).length) throw invalid("Please fill in the required fields.", fieldErrors);

  const values = { ...auto, ...custom };
  const body = fillPlaceholders(template.body, values);
  const party = deal.client?.fullName ?? deal.lead?.fullName ?? "client";
  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx, "contract", "CT");
    const contract = await tx.contract.create({
      data: {
        reference, dealId: deal.id, templateId: template.id, templateName: template.name, templateVersion: template.version,
        title: `${template.name} — ${party}`, body, values: JSON.stringify(values), createdById: actor.id,
      },
      select: { id: true, reference: true, title: true },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "CONTRACT", entityId: contract.id, entityLabel: contract.reference, userId: actor.id, dealId: deal.id,
      clientId: deal.client?.id ?? null, leadId: deal.lead?.id ?? null,
      description: `Generated ${contract.reference} (${template.name}) for ${deal.reference}`,
    });
    // The agent's "prepare the contract" task is done.
    await tx.task.updateMany({ where: { autoKey: `prepare-contract:${deal.id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    return contract;
  });
}

export async function getContract(actor: Actor, id: string) {
  const contract = await db.contract.findUnique({
    where: { id },
    select: { id: true, reference: true, title: true, body: true, templateName: true, templateVersion: true, createdAt: true, createdBy: { select: { name: true } }, dealId: true, deal: { select: { reference: true, agentId: true } } },
  });
  if (!contract) return null;
  const inScope = await db.deal.count({ where: { id: contract.dealId, ...scope.deals(actor) } });
  return inScope ? contract : null;
}
