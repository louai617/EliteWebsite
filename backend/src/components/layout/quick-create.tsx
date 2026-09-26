"use client";

import Link from "next/link";
import { Building2, CalendarClock, CheckSquare, Handshake, KeyRound, Plus, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ITEMS = [
  { href: "/leads?new=1", label: "Lead", icon: UsersRound },
  { href: "/clients?new=1", label: "Client", icon: UserRound },
  { href: "/owners?new=1", label: "Owner", icon: KeyRound },
  { href: "/properties/new", label: "Property", icon: Building2 },
  { href: "/viewings?new=1", label: "Viewing", icon: CalendarClock },
  { href: "/deals?new=1", label: "Deal", icon: Handshake },
  { href: "/tasks?new=1", label: "Task", icon: CheckSquare },
];

export function QuickCreate() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus /> <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon /> {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
