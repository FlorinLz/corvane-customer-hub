"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ResetDemoDataDialog } from "@/components/shell/ResetDemoDataDialog";
import { cn } from "@/lib/utils";

// Brief 6.12 "Layout: top bar, left sub-navigation (tabs above content at
// 1024px), page content." Users is for the Admin only.
export function AdminSidebar({ isAdmin, demoMode }: { isAdmin: boolean; demoMode: boolean }) {
  const pathname = usePathname();
  const [resetOpen, setResetOpen] = React.useState(false);

  const links = [
    isAdmin && { href: "/admin/users", label: "Users" },
    isAdmin && { href: "/admin/deleted-records", label: "Deleted records" },
    { href: "/admin/roles-permissions", label: "Roles & permissions" },
  ].filter((l): l is { href: string; label: string } => !!l);

  return (
    <>
      <nav aria-label="Admin" className="flex shrink-0 flex-col gap-1 border-b border-border pb-4 lg:w-[200px] lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
        <span className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-secondary">Admin</span>
        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "whitespace-nowrap rounded-sm px-2 py-1.5 text-body text-text no-underline",
                  active ? "bg-selected font-medium text-primary" : "hover:bg-tint",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        {isAdmin && demoMode && (
          <>
            <div className="mt-2 hidden border-t border-border pt-2 lg:block" />
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="rounded-sm px-2 py-1.5 text-left text-body text-danger hover:bg-tint"
            >
              Reset demo data
            </button>
          </>
        )}
      </nav>
      {isAdmin && demoMode && <ResetDemoDataDialog open={resetOpen} onOpenChange={setResetOpen} />}
    </>
  );
}
