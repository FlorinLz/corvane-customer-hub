"use client";

import * as React from "react";
import Link from "next/link";

import { STAGE_LABELS } from "@/lib/labels";
import type { Stage } from "@prisma/client";

export interface CoverageCustomerRow {
  entityId: string;
  entityName: string;
  /** The furthest stage of its live lines on this scheme and country. */
  stage: Stage;
}

const SHOWN = 5;

/** "Customers on this coverage (n)": who a failure on this scheme and country reaches. Read only; five rows, then "Show all". */
export function CoverageCustomers({ customers }: { customers: CoverageCustomerRow[] }) {
  const [all, setAll] = React.useState(false);
  const rows = all ? customers : customers.slice(0, SHOWN);
  return (
    <div data-testid="coverage-customers" className="mt-2 flex flex-col gap-1 rounded-sm bg-tint px-3 py-2">
      <p className="text-meta font-medium text-text-secondary">Customers on this coverage ({customers.length})</p>
      {customers.length === 0 ? (
        <p className="text-meta text-text-secondary">No customer is live on it.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {rows.map((c) => (
            <li key={c.entityId} className="flex items-center gap-3 text-body">
              <Link href={`/entities/${c.entityId}/overview`} className="text-link-text hover:underline">
                {c.entityName}
              </Link>
              <span className="text-meta text-text-secondary">{STAGE_LABELS[c.stage]}</span>
            </li>
          ))}
        </ul>
      )}
      {customers.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="self-start text-meta text-link-text hover:underline">
          {all ? "Show fewer" : "Show all"}
        </button>
      )}
    </div>
  );
}
