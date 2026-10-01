import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CheckSquare,
  CloudDownload,
  Gauge,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { PROPERTY_HIERARCHY } from "@/lib/constants";
import { hasPermission, type Actor, type Permission } from "@/lib/permissions";

export interface NavItem {
  /** Path, optionally with a query string (e.g. /properties?category=COMMERCIAL). */
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Only shown to users with this permission (see lib/permissions.ts). */
  permission?: Permission;
  children?: NavItem[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** Properties › Residential/Commercial › Company/Private, generated from the hierarchy definition. */
const propertyChildren: NavItem[] = [
  { href: "/properties", label: "All properties" },
  ...PROPERTY_HIERARCHY.map((node) => ({
    href: `/properties?category=${node.category}`,
    label: node.label,
    children: node.subcategories.map((sub) => ({
      href: `/properties?category=${node.category}&subcategory=${sub.subcategory}`,
      label: sub.label,
    })),
  })),
];

export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Building2, children: propertyChildren },
      { href: "/leads", label: "Leads", icon: UsersRound },
      { href: "/clients", label: "Clients", icon: UserRound },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/tasks",
        label: "Tasks",
        icon: CheckSquare,
        children: [
          { href: "/tasks", label: "My tasks" },
          { href: "/tasks/team", label: "Team tasks", permission: "tasks.viewTeam" },
          { href: "/tasks/daily", label: "Daily tasks" },
        ],
      },
      { href: "/viewings", label: "Viewings", icon: CalendarClock },
      { href: "/deals", label: "Deals", icon: Handshake },
      { href: "/owners", label: "Owners", icon: KeyRound },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/performance", label: "Performance", icon: Gauge },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/users", label: "Users", icon: Users, permission: "users.manage" },
      { href: "/imports", label: "Imports", icon: CloudDownload, permission: "imports.run" },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

/** Removes items (and children) the user may not see; drops empty groups. */
export function visibleNav(actor: Actor): NavGroup[] {
  const filter = (items: NavItem[]): NavItem[] =>
    items
      .filter((item) => !item.permission || hasPermission(actor, item.permission))
      .map((item) => (item.children ? { ...item, children: filter(item.children) } : item));
  return NAV.map((group) => ({ ...group, items: filter(group.items) })).filter((group) => group.items.length > 0);
}

/**
 * Whether a nav link matches the current location. Links with a query string match when
 * every listed param is present with that value; "exact" links (section roots like
 * "All properties" or "My tasks") match only the bare path without hierarchy params.
 */
export function isActive(pathname: string, search: URLSearchParams, href: string, { exact = false } = {}) {
  const [path, query] = href.split("?");
  if (path === "/") return pathname === "/";
  if (query) {
    if (pathname !== path) return false;
    const wanted = new URLSearchParams(query);
    for (const [k, v] of wanted) if (search.get(k) !== v) return false;
    // A category link is not active when a subcategory is also selected (its child is).
    if (!wanted.has("subcategory") && search.has("subcategory")) return false;
    return true;
  }
  if (exact) return pathname === path && !search.has("category");
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** True if the item or any descendant is active (used to auto-expand sections). */
export function hasActiveDescendant(item: NavItem, pathname: string, search: URLSearchParams): boolean {
  if (!item.children) return isActive(pathname, search, item.href);
  return item.children.some((child) => hasActiveDescendant(child, pathname, search) || isActive(pathname, search, child.href, { exact: !child.href.includes("?") }));
}
