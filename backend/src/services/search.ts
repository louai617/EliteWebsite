import "server-only";
import { db } from "@/lib/db";
import { can, scope, type Actor } from "@/lib/permissions";
import { CUSTOMER_TYPE_META, DEAL_STATUS_META, LEAD_STATUS_META, PROPERTY_STATUS_META, ROLE_META } from "@/lib/constants";
import { formatMoneyCompact } from "@/lib/format";
import { digitsOnly, like } from "@/lib/search";
import type { LookupOption, SearchGroup } from "@/types/search";

function phoneFilter(q: string) {
  const digits = digitsOnly(q);
  // Phones are stored formatted ("+974 5512 3456"); match on the last digits the user typed.
  return digits.length >= 4 ? [{ phone: like(digits.slice(-4)) }] : [];
}

/**
 * Global search across every module, respecting the actor's data scope.
 * "Ahmed" finds Ahmed's leads and client profile, properties he owns and deals he is on.
 */
export async function globalSearch(actor: Actor, raw: string, perGroup = 5): Promise<SearchGroup[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return [];

  const [leads, clients, owners, properties, deals, users] = await Promise.all([
    db.lead.findMany({
      where: { AND: [scope.leads(actor), { OR: [{ fullName: like(q) }, { email: like(q) }, ...phoneFilter(q)] }] },
      select: { id: true, fullName: true, phone: true, status: true, interestedArea: true },
      orderBy: { updatedAt: "desc" },
      take: perGroup,
    }),
    db.client.findMany({
      where: { AND: [scope.clients(actor), { OR: [{ fullName: like(q) }, { email: like(q) }, { idReference: like(q) }, ...phoneFilter(q)] }] },
      select: { id: true, fullName: true, phone: true, clientType: true },
      orderBy: { updatedAt: "desc" },
      take: perGroup,
    }),
    db.owner.findMany({
      where: { AND: [scope.owners(actor), { OR: [{ fullName: like(q) }, { email: like(q) }, ...phoneFilter(q)] }] },
      select: { id: true, fullName: true, phone: true, _count: { select: { properties: true } } },
      orderBy: { updatedAt: "desc" },
      take: perGroup,
    }),
    db.property.findMany({
      where: {
        AND: [
          scope.properties(actor),
          {
            OR: [
              { reference: like(q) },
              { title: like(q) },
              { area: like(q) },
              { buildingName: like(q) },
              { tower: like(q) },
              { owner: { fullName: like(q) } },
            ],
          },
        ],
      },
      select: { id: true, reference: true, title: true, area: true, status: true, price: true, currency: true, owner: { select: { fullName: true } } },
      orderBy: { updatedAt: "desc" },
      take: perGroup,
    }),
    db.deal.findMany({
      where: {
        AND: [
          scope.deals(actor),
          {
            OR: [
              { reference: like(q) },
              { client: { fullName: like(q) } },
              { owner: { fullName: like(q) } },
              { property: { OR: [{ reference: like(q) }, { title: like(q) }] } },
            ],
          },
        ],
      },
      select: { id: true, reference: true, status: true, amount: true, client: { select: { fullName: true } }, property: { select: { reference: true } } },
      orderBy: { updatedAt: "desc" },
      take: perGroup,
    }),
    can.manageUsers(actor)
      ? db.user.findMany({
          where: { OR: [{ name: like(q) }, { email: like(q) }] },
          select: { id: true, name: true, email: true, role: true },
          take: perGroup,
        })
      : Promise.resolve([]),
  ]);

  const groups: SearchGroup[] = [
    {
      kind: "lead",
      label: "Leads",
      items: leads.map((l) => ({
        id: l.id,
        title: l.fullName,
        subtitle: [l.phone, l.interestedArea].filter(Boolean).join(" · "),
        badge: LEAD_STATUS_META[l.status].label,
        href: `/leads/${l.id}`,
      })),
    },
    {
      kind: "client",
      label: "Clients",
      items: clients.map((c) => ({ id: c.id, title: c.fullName, subtitle: c.phone, badge: CUSTOMER_TYPE_META[c.clientType].label, href: `/clients/${c.id}` })),
    },
    {
      kind: "owner",
      label: "Owners",
      items: owners.map((o) => ({
        id: o.id,
        title: o.fullName,
        subtitle: `${o.phone} · ${o._count.properties} ${o._count.properties === 1 ? "property" : "properties"}`,
        href: `/owners/${o.id}`,
      })),
    },
    {
      kind: "property",
      label: "Properties",
      items: properties.map((p) => ({
        id: p.id,
        title: `${p.reference} · ${p.title}`,
        subtitle: [p.area, formatMoneyCompact(p.price, p.currency), p.owner ? `Owner: ${p.owner.fullName}` : null].filter(Boolean).join(" · "),
        badge: PROPERTY_STATUS_META[p.status].label,
        href: `/properties/${p.id}`,
      })),
    },
    {
      kind: "deal",
      label: "Deals",
      items: deals.map((d) => ({
        id: d.id,
        title: `${d.reference} · ${d.client.fullName}`,
        subtitle: `${d.property.reference} · ${formatMoneyCompact(d.amount)}`,
        badge: DEAL_STATUS_META[d.status].label,
        href: `/deals/${d.id}`,
      })),
    },
    {
      kind: "user",
      label: "Team",
      items: users.map((u) => ({ id: u.id, title: u.name, subtitle: u.email, badge: ROLE_META[u.role].label, href: `/users?q=${encodeURIComponent(u.email)}` })),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export const LOOKUP_TYPES = ["property", "lead", "client", "owner", "deal"] as const;
export type LookupType = (typeof LOOKUP_TYPES)[number];

/** Options for async pickers in forms. */
export async function lookup(actor: Actor, type: LookupType, raw: string, take = 20): Promise<LookupOption[]> {
  const q = raw.trim().slice(0, 100);
  switch (type) {
    case "property": {
      const rows = await db.property.findMany({
        where: { AND: [scope.properties(actor), q ? { OR: [{ reference: like(q) }, { title: like(q) }, { area: like(q) }, { buildingName: like(q) }] } : {}] },
        select: { id: true, reference: true, title: true, area: true, status: true },
        orderBy: { updatedAt: "desc" },
        take,
      });
      return rows.map((r) => ({ id: r.id, label: `${r.reference} · ${r.title}`, hint: `${r.area} · ${PROPERTY_STATUS_META[r.status].label}` }));
    }
    case "lead": {
      const rows = await db.lead.findMany({
        where: { AND: [scope.leads(actor), q ? { OR: [{ fullName: like(q) }, { email: like(q) }, ...phoneFilter(q)] } : {}] },
        select: { id: true, fullName: true, phone: true, status: true },
        orderBy: { updatedAt: "desc" },
        take,
      });
      return rows.map((r) => ({ id: r.id, label: r.fullName, hint: `${r.phone} · ${LEAD_STATUS_META[r.status].label}` }));
    }
    case "client": {
      const rows = await db.client.findMany({
        where: { AND: [scope.clients(actor), q ? { OR: [{ fullName: like(q) }, { email: like(q) }, ...phoneFilter(q)] } : {}] },
        select: { id: true, fullName: true, phone: true, clientType: true },
        orderBy: { updatedAt: "desc" },
        take,
      });
      return rows.map((r) => ({ id: r.id, label: r.fullName, hint: `${r.phone} · ${CUSTOMER_TYPE_META[r.clientType].label}` }));
    }
    case "owner": {
      const rows = await db.owner.findMany({
        where: { AND: [scope.owners(actor), q ? { OR: [{ fullName: like(q) }, { email: like(q) }, ...phoneFilter(q)] } : {}] },
        select: { id: true, fullName: true, phone: true },
        orderBy: { fullName: "asc" },
        take,
      });
      return rows.map((r) => ({ id: r.id, label: r.fullName, hint: r.phone }));
    }
    case "deal": {
      const rows = await db.deal.findMany({
        where: { AND: [scope.deals(actor), q ? { OR: [{ reference: like(q) }, { client: { fullName: like(q) } }] } : {}] },
        select: { id: true, reference: true, client: { select: { fullName: true } }, status: true },
        orderBy: { updatedAt: "desc" },
        take,
      });
      return rows.map((r) => ({ id: r.id, label: `${r.reference} · ${r.client.fullName}`, hint: DEAL_STATUS_META[r.status].label }));
    }
  }
}

/** Resolve the label for an already-selected id (edit forms). */
export async function lookupLabel(actor: Actor, type: LookupType, id: string): Promise<LookupOption | null> {
  switch (type) {
    case "property": {
      const r = await db.property.findFirst({ where: { id, ...scope.properties(actor) }, select: { id: true, reference: true, title: true, area: true } });
      return r && { id: r.id, label: `${r.reference} · ${r.title}`, hint: r.area };
    }
    case "lead": {
      const r = await db.lead.findFirst({ where: { id, ...scope.leads(actor) }, select: { id: true, fullName: true, phone: true } });
      return r && { id: r.id, label: r.fullName, hint: r.phone };
    }
    case "client": {
      const r = await db.client.findFirst({ where: { id, ...scope.clients(actor) }, select: { id: true, fullName: true, phone: true } });
      return r && { id: r.id, label: r.fullName, hint: r.phone };
    }
    case "owner": {
      const r = await db.owner.findFirst({ where: { id, ...scope.owners(actor) }, select: { id: true, fullName: true, phone: true } });
      return r && { id: r.id, label: r.fullName, hint: r.phone };
    }
    case "deal": {
      const r = await db.deal.findFirst({ where: { id, ...scope.deals(actor) }, select: { id: true, reference: true } });
      return r && { id: r.id, label: r.reference };
    }
  }
}
