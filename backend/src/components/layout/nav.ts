import {
  Activity,
  Building2,
  CalendarClock,
  CheckSquare,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "CRM",
    items: [
      { href: "/leads", label: "Leads", icon: UsersRound },
      { href: "/clients", label: "Clients", icon: UserRound },
      { href: "/owners", label: "Owners", icon: KeyRound },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/deals", label: "Deals", icon: Handshake },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/viewings", label: "Viewings", icon: CalendarClock },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/users", label: "Users", icon: Users, roles: ["ADMIN", "MANAGER"] },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
