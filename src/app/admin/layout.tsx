import { AdminSidebar } from "@/components/shell/AdminSidebar";
import { getCurrentUser } from "@/server/session";

// Brief 6.12 layout: top bar (root layout), left sub-navigation, page
// content. No sidebar chrome for a viewer with no admin access at all —
// their page body is the 403 message alone (matches the wizard/other
// access pages, which get no extra chrome either).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isCompliance = user.team === "COMPLIANCE";

  if (!user.isAdmin && !isCompliance) return <>{children}</>;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <AdminSidebar isAdmin={user.isAdmin} demoMode={process.env.DEMO_MODE === "true"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
