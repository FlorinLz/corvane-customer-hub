"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Brief 6.12, 4.1.6: the admin sees Deleted records and Roles & permissions
// (no Reset demo data: the demo restores itself, src/server/demo-idle.ts); Compliance sees Roles &
// permissions only; everyone else gets no menu. R1 has no "Users & roles"
// entry (6.12.1 is R2).
export function AdminMenu({ isAdmin, isCompliance }: { isAdmin: boolean; isCompliance: boolean }) {
  if (!isAdmin && !isCompliance) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm px-2 py-1 text-body text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <span>Admin</span>
        <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin/deleted-records">Deleted records</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/admin/roles-permissions">Roles &amp; permissions</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
