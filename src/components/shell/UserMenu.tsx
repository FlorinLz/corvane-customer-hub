"use client";

import { ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TEAM_LABELS, initials, type DemoUser } from "@/lib/demo-users";

// Brief 5.2 User menu: name, email and team read-only; "Sign out" hidden in
// DEMO_MODE (always on for now; demo mode wiring lands in milestone 2).
export function UserMenu({ user, demoMode = true }: { user: DemoUser; demoMode?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm px-2 py-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <Avatar>
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-body font-medium text-text lg:inline">
          {user.name} · {TEAM_LABELS[user.team]}
        </span>
        {user.isAdmin && <Badge variant="admin">Admin</Badge>}
        <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px] p-3">
        <div className="text-body font-medium text-text">{user.name}</div>
        <div className="text-meta text-text-secondary">{user.email}</div>
        <DropdownMenuSeparator />
        <div className="text-meta text-text-secondary">Team</div>
        <div className="text-body text-text">{TEAM_LABELS[user.team]}</div>
        {!demoMode && (
          <>
            <DropdownMenuSeparator />
            <button type="button" className="text-left text-body text-primary hover:underline">
              Sign out
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
