"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { ResetDemoDataDialog } from "@/components/shell/ResetDemoDataDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Brief 6.12, 4.1.6: the admin sees Deleted records, Roles & permissions
// and (DEMO_MODE only) Reset demo data; Compliance sees Roles &
// permissions only; everyone else gets no menu. R1 has no "Users & roles"
// entry (6.12.1 is R2).
export function AdminMenu({ isAdmin, isCompliance, demoMode }: { isAdmin: boolean; isCompliance: boolean; demoMode: boolean }) {
  const [resetOpen, setResetOpen] = React.useState(false);
  if (!isAdmin && !isCompliance) return null;

  return (
    <>
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
          {isAdmin && demoMode && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger" onSelect={() => setResetOpen(true)}>
                Reset demo data
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isAdmin && demoMode && <ResetDemoDataDialog open={resetOpen} onOpenChange={setResetOpen} />}
    </>
  );
}
