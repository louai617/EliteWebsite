export type SearchKind = "lead" | "client" | "owner" | "property" | "deal" | "user";

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  items: SearchHit[];
}

export interface LookupOption {
  id: string;
  label: string;
  hint?: string;
}
