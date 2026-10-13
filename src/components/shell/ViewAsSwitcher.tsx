"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEMO_USERS, TEAM_LABELS, type DemoUser } from "@/lib/demo-users";

function UserLabel({ user }: { user: DemoUser }) {
  return (
    <span className="inline-flex items-center gap-2">
      {TEAM_LABELS[user.team]} · {user.name}
      {user.isAdmin && <Badge variant="admin">Admin</Badge>}
    </span>
  );
}

/**
 * Brief 5.2, 7.2.2, M15 AC11. Posts to /api/demo/view-as, which rewrites
 * the ch_user cookie, then refreshes the current route so every server
 * component re-reads the session. The "View as" text is a separate
 * <label>, owned by DemoStrip — this is just the pill (the
 * demo strip select).
 *
 * The select is controlled and SelectValue's children are set explicitly:
 * Radix only mirrors an item's rendered text into the trigger once that
 * item has mounted inside the (portal-rendered, lazily-mounted) content,
 * so an uncontrolled select with only a `defaultValue` shows a blank
 * trigger until the user opens it once.
 *
 * Keyed by email, not team (milestone 8): several seeded users can share a
 * team, so team alone no longer picks a unique person. Teams stay adjacent
 * in DEMO_USERS, so the flat list still reads as grouped by team.
 */
export function ViewAsSwitcher({ id, currentEmail }: { id?: string; currentEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState(currentEmail);
  const [pending, startTransition] = React.useTransition();
  const currentUser = DEMO_USERS.find((u) => u.email === email) ?? DEMO_USERS[0];

  async function switchTo(nextEmail: string) {
    const user = DEMO_USERS.find((u) => u.email === nextEmail);
    if (!user) return;
    const res = await fetch("/api/demo/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: nextEmail }),
    });
    if (!res.ok) {
      toast.error("Couldn't switch user. Try again.");
      return;
    }
    setEmail(nextEmail);
    // Bottom-left, so it never covers the table the new viewer is about to see.
    toast.info(`Now viewing as ${user.name} (${TEAM_LABELS[user.team]})`, { position: "bottom-left" });
    startTransition(() => router.refresh());
  }

  return (
    <Select value={email} onValueChange={(nextEmail) => void switchTo(nextEmail)} disabled={pending}>
      <SelectTrigger
        id={id}
        aria-label="View as"
        className="h-6 gap-2 rounded-sm border border-white/40 bg-transparent px-2 text-meta text-white focus-visible:outline-white"
      >
        <SelectValue>
          <UserLabel user={currentUser} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {DEMO_USERS.map((user) => (
          <SelectItem key={user.email} value={user.email}>
            <UserLabel user={user} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
