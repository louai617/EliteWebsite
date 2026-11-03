import "server-only";
import type { ContractField } from "@/lib/contract-format";

/**
 * Starting drafts created the first time contracts are opened. They are generic and must be
 * reviewed by the company's legal adviser — the admin edits them under Settings → Contracts.
 */
export const DEFAULT_TEMPLATES: { name: string; description: string; dealType: "SALE" | "RENTAL"; fields: ContractField[]; body: string }[] = [
  {
    name: "Property sale agreement",
    description: "Sale of a property after the booking deposit. Review with your legal adviser before use.",
    dealType: "SALE",
    fields: [
      { key: "deposit_amount", label: "Booking deposit paid (QAR)", type: "money", required: true },
      { key: "balance_due_date", label: "Balance due date", type: "date", required: true },
      { key: "handover_date", label: "Handover date", type: "date", required: true },
      { key: "special_conditions", label: "Special conditions", type: "textarea", required: false },
    ],
    body: `# Property Sale Agreement

**Reference:** {{deal_reference}}
**Date:** {{today}}

## 1. Parties

**Seller:** {{owner_name}}, telephone {{owner_phone}} (the "Seller").

**Buyer:** {{client_name}}, {{client_nationality}} national, QID / passport no. {{client_id_number}}, telephone {{client_phone}}, e-mail {{client_email}} (the "Buyer").

**Broker:** {{company_name}}, represented by {{agent_name}} ({{agent_phone}}).

## 2. Property

{{property_title}} — reference {{property_reference}}
{{property_type}}, {{property_size}}, {{property_bedrooms}} bedroom(s)
Address: {{property_address}}

## 3. Price and payment

The agreed sale price is **{{deal_amount}}** ({{deal_amount_words}}).

- Booking deposit already paid: QAR {{deposit_amount}}
- The balance is payable on or before {{balance_due_date}}.
- Payments are made to the Seller's nominated account against official receipts.

## 4. Handover

The Seller hands over the property, free of occupants and with all keys, access cards and documents, on {{handover_date}}, after the full price is received and the transfer of ownership is registered.

## 5. Commission

The broker's commission of {{commission_percent}} ({{commission_amount}}) is due on signing this agreement, as agreed with the broker.

## 6. Special conditions

{{special_conditions}}

## 7. Law

This agreement is governed by the laws of the State of Qatar.

---

**Seller:** ______________________          **Buyer:** ______________________

Date: ______________                          Date: ______________

**For {{company_name}}:** ______________________ ({{agent_name}})`,
  },
  {
    name: "Residential tenancy agreement",
    description: "Lease of a residential unit. Review with your legal adviser before use.",
    dealType: "RENTAL",
    fields: [
      { key: "lease_start", label: "Lease start date", type: "date", required: true },
      { key: "lease_end", label: "Lease end date", type: "date", required: true },
      { key: "monthly_rent", label: "Monthly rent (QAR)", type: "money", required: true },
      { key: "security_deposit", label: "Security deposit (QAR)", type: "money", required: true },
      { key: "cheques", label: "Number of rent cheques", type: "number", required: false },
      { key: "special_conditions", label: "Special conditions", type: "textarea", required: false },
    ],
    body: `# Residential Tenancy Agreement

**Reference:** {{deal_reference}}
**Date:** {{today}}

## 1. Parties

**Landlord:** {{owner_name}}, telephone {{owner_phone}} (the "Landlord").

**Tenant:** {{client_name}}, {{client_nationality}} national, QID / passport no. {{client_id_number}}, telephone {{client_phone}}, e-mail {{client_email}} (the "Tenant").

**Broker:** {{company_name}}, represented by {{agent_name}} ({{agent_phone}}).

## 2. Premises

{{property_title}} — reference {{property_reference}}
{{property_type}}, {{property_size}}, {{property_bedrooms}} bedroom(s)
Address: {{property_address}}

## 3. Term

From {{lease_start}} to {{lease_end}}.

## 4. Rent

- Monthly rent: QAR {{monthly_rent}}
- Total contract value: {{deal_amount}} ({{deal_amount_words}})
- Payment by {{cheques}} post-dated cheque(s) or as agreed in writing.
- Security deposit: QAR {{security_deposit}}, refundable at the end of the lease less any damage beyond normal wear.

## 5. Use and maintenance

- The premises are for residential use by the Tenant and family only.
- The Tenant keeps the premises clean and in good condition and reports any defects promptly.
- Major repairs are the Landlord's responsibility unless caused by the Tenant.

## 6. Registration

The lease will be registered with the Real Estate Lease Registration Office as required by Qatari law.

## 7. Special conditions

{{special_conditions}}

---

**Landlord:** ______________________          **Tenant:** ______________________

Date: ______________                            Date: ______________

**For {{company_name}}:** ______________________ ({{agent_name}})`,
  },
];
