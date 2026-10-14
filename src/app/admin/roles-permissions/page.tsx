import { Fragment } from "react";
import { Team } from "@prisma/client";

import { AdminAccessDenied } from "@/components/shell/AdminAccessDenied";
import { Badge } from "@/components/ui/badge";
import { TEAM_LABELS } from "@/lib/labels";
import { MATRIX_GROUPS, PERMISSION_MATRIX, type Cell } from "@/server/permissions/matrix";
import { can } from "@/server/permissions/can";
import { getCurrentUser } from "@/server/session";

const TEAM_ORDER: Team[] = [Team.SALES, Team.OPS, Team.CS, Team.NETWORK, Team.COMPLIANCE, Team.FINANCE];

function CellBadge({ cell, note }: { cell: Cell; note?: string }) {
  const content = (() => {
    switch (cell) {
      case "E":
        return <Badge variant="selected">E</Badge>;
      case "R":
        return <span className="text-text-secondary">R</span>;
      case "add":
        return <span className="text-text-secondary">add</span>;
      case "admin":
        return <Badge variant="admin">admin</Badge>;
      case "hidden":
        return <span className="text-text-disabled">hidden</span>;
      case "none":
        return <span className="text-text-disabled">none</span>;
    }
  })();
  return (
    <div className="flex flex-col gap-0.5">
      {content}
      {note && <span className="text-meta text-text-secondary">{note}</span>}
    </div>
  );
}

// Brief 6.12.3, M15 AC13: generated straight from PERMISSION_MATRIX, the
// same module can() enforces — never a copy of its values.
export default async function RolesPermissionsPage() {
  const user = await getCurrentUser();
  if (!can(user, "admin.permissions.read").ok) return <AdminAccessDenied />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page">Roles &amp; permissions</h1>
        <p className="text-meta text-text-secondary">Generated from the permission matrix the server enforces. Read-only.</p>
      </div>

      <div className="flex flex-wrap gap-3 text-meta text-text-secondary">
        <span className="flex items-center gap-1"><Badge variant="selected">E</Badge> Edits</span>
        <span className="flex items-center gap-1">R Reads</span>
        <span className="flex items-center gap-1">add Adds notes</span>
        <span className="flex items-center gap-1">hidden Not visible</span>
        <span className="flex items-center gap-1">none No access</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[900px] text-left text-meta">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="sticky left-0 bg-surface px-3 py-2">Data area</th>
              {TEAM_ORDER.map((team) => (
                <th key={team} className="px-3 py-2">{TEAM_LABELS[team]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_GROUPS.map((group) => {
              const rows = PERMISSION_MATRIX.filter((p) => p.group === group);
              if (rows.length === 0) return null;
              return (
                <Fragment key={group}>
                  <tr className="border-b border-border bg-tint">
                    <td colSpan={TEAM_ORDER.length + 1} className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">
                      {group}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.area} className="border-b border-border align-top last:border-b-0">
                      <td className="sticky left-0 bg-surface px-3 py-2 font-medium text-text">{row.rowLabel}</td>
                      {TEAM_ORDER.map((team) => (
                        <td key={team} className="px-3 py-2">
                          <CellBadge cell={row.cells[team]} note={row.cellNotes?.[team]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 text-meta text-text-secondary">
        <p>The admin flag (Adrian Koh, Ops) adds Users &amp; roles, Deleted records, Roles &amp; permissions, and the Audit tab. It adds no edit rights on data.</p>
        <p>In the Partner context every contact role is owned by Network, except Billing, which Finance owns.</p>
      </div>
    </div>
  );
}
