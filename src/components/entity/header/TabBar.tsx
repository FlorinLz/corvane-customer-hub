"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface TabDef {
  key: string;
  label: string;
}

// Brief 6.1 "Tab bar". Audit shows only for Compliance and the admin
// (M15 AC3 row 26, brief 6.10).
const ALL_TABS: TabDef[] = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Details" },
  { key: "products", label: "Products & onboarding" },
  { key: "contacts", label: "Contacts" },
  { key: "history", label: "History" },
  { key: "issues", label: "Issues" },
  { key: "partner", label: "Partner" },
  { key: "compliance", label: "Compliance" },
  { key: "billing", label: "Billing" },
  { key: "audit", label: "Audit" },
];

export function TabBar({
  entityId,
  hasCustomerRole,
  hasPartnerRole,
  showAudit,
}: {
  entityId: string;
  hasCustomerRole: boolean;
  hasPartnerRole: boolean;
  showAudit: boolean;
}) {
  const pathname = usePathname();
  const current = pathname.split("/").pop();

  const tabs = ALL_TABS.filter((t) => {
    if (t.key === "products") return hasCustomerRole;
    if (t.key === "partner") return hasPartnerRole;
    if (t.key === "audit") return showAudit;
    return true;
  });

  return (
    <nav className="flex gap-0 overflow-x-auto border-b border-border" aria-label="Entity record tabs">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={`/entities/${entityId}/${tab.key}`}
            className={cn(
              "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 border-transparent px-4 text-body font-medium text-text-secondary no-underline",
              active && "border-primary bg-selected font-semibold text-primary",
            )}
            aria-current={active ? "page" : undefined}
            data-onboarding={`${tab.key}-tab`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
