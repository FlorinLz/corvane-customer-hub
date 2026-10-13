import { AdminAccessDenied } from "@/components/shell/AdminAccessDenied";
import { Badge } from "@/components/ui/badge";
import { TEAM_LABELS } from "@/lib/labels";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

/**
 * Admin > Users: the list of everyone who can sign in, for the Admin only (the same gate as Deleted records). It used to render the
 * "No access to Admin" message for every viewer, the Admin included, because the page was a placeholder (brief 6.12.1).
 */
export default async function AdminUsersPage() {
  const viewer = await getCurrentUser();
  if (!viewer.isAdmin) return <AdminAccessDenied />;

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, team: true, isAdmin: true, active: true, timeZone: true },
    orderBy: [{ team: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-page">Users</h1>
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-meta" data-testid="admin-users-table">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Admin</th>
              <th className="px-3 py-2">Time zone</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{TEAM_LABELS[u.team]}</td>
                <td className="px-3 py-2">{u.isAdmin ? <Badge variant="selected">Admin</Badge> : "—"}</td>
                <td className="px-3 py-2">{u.timeZone}</td>
                <td className="px-3 py-2">{u.active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
