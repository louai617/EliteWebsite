import "server-only";
import type { CustomerType } from "@/generated/prisma/enums";
import { logActivity } from "./activity";
import type { Tx } from "./types";

/**
 * Creates the client profile for a lead inside an existing transaction (or returns the one it
 * is already linked to). Carries over contact details, requirements, interests and the lead's
 * documents. Used by "Convert to client" and by closing a deal.
 */
export async function convertLeadInTx(tx: Tx, leadId: string, actorId: string | null): Promise<{ clientId: string; created: boolean }> {
  const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId }, include: { interests: { select: { propertyId: true } } } });
  if (lead.clientId) {
    await tx.document.updateMany({ where: { leadId, clientId: null }, data: { clientId: lead.clientId } });
    return { clientId: lead.clientId, created: false };
  }

  const clientType: CustomerType = lead.leadType ?? (lead.purpose === "RENT" ? "TENANT" : "BUYER");
  const client = await tx.client.create({
    data: {
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      nationality: lead.nationality,
      clientType,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      requirements:
        [
          lead.purpose && `Looking to ${lead.purpose === "RENT" ? "rent" : "buy"}`,
          lead.bedrooms != null && `${lead.bedrooms === 0 ? "Studio" : `${lead.bedrooms} bedrooms`}`,
          lead.interestedArea && `in ${lead.interestedArea}`,
        ]
          .filter(Boolean)
          .join(", ") || null,
      notes: lead.notes,
      agentId: lead.agentId,
      interests: { create: lead.interests.map((i) => ({ propertyId: i.propertyId })) },
    },
    select: { id: true, fullName: true },
  });
  await tx.lead.update({ where: { id: leadId }, data: { clientId: client.id } });
  // The lead's paperwork (booking form, payment proof, IDs…) moves onto the client's file too.
  await tx.document.updateMany({ where: { leadId, clientId: null }, data: { clientId: client.id } });
  // Viewings booked for the lead belong to the client from now on.
  await tx.viewing.updateMany({ where: { leadId, clientId: null }, data: { clientId: client.id } });
  await logActivity(tx, {
    action: "CONVERTED", entityType: "LEAD", entityId: leadId, entityLabel: lead.fullName,
    description: `Converted lead ${lead.fullName} into a client`, userId: actorId, leadId, clientId: client.id,
  });
  await logActivity(tx, {
    action: "CREATED", entityType: "CLIENT", entityId: client.id, entityLabel: client.fullName,
    description: `Added client ${client.fullName} from a lead`, userId: actorId, clientId: client.id, leadId,
  });
  return { clientId: client.id, created: true };
}
