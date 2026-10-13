import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { AdminMenu } from "@/components/shell/AdminMenu";
import { GlobalSearchBar } from "@/components/shell/GlobalSearchBar";
import { HomeLink } from "@/components/shell/HomeLink";
import { UserMenu } from "@/components/shell/UserMenu";
import type { DemoUser } from "@/lib/demo-users";

// Brief 5.2 layout region 2; Admin menu per 4.1.6, added in milestone 4.
export function TopBar({ user, demoMode }: { user: DemoUser; demoMode: boolean }) {
  return (
    <div className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4 lg:gap-6 lg:px-6">
      <Link href="/" aria-label="Corvane Customer Hub, go to Home">
        <Logo />
      </Link>
      <HomeLink viewerEmail={user.email} />
      <GlobalSearchBar className="flex-1" />
      {/* A second flex-1 spacer after the
          capped-width search bar, so the user menu stays flush right
          instead of trailing right after the search bar. */}
      <span className="flex-1" aria-hidden="true" />
      <AdminMenu isAdmin={user.isAdmin} isCompliance={user.team === "COMPLIANCE"} demoMode={demoMode} />
      <UserMenu user={user} />
    </div>
  );
}
