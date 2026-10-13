"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { formatInZone } from "@/lib/time-zones";
import { TEAM_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAX_BODY = 5000;

export interface IssueNoteRow {
  id: string;
  kind: "NOTE" | "ADDED_REPORT" | "SYSTEM";
  body: string;
  authorName: string;
  authorTeam: string | null;
  createdAt: Date;
}

/**
 * "Internal notes. Never sent to the customer". Only notes written by people (the "Also reported by ..." notes are theirs too);
 * system events stay in History. All 6 teams can add; notes cannot be edited or deleted, newest first. "Add note" in the card header opens an
 * inline field with Save and Cancel (M21 AC7: author, team and timestamp in the viewer's time zone).
 */
export function NotesSection({ issueId, notes, viewerZone, partner = false }: { issueId: string; notes: IssueNoteRow[]; viewerZone: string; partner?: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const people = notes.filter((n) => n.kind !== "SYSTEM");

  function cancel() {
    setAdding(false);
    setBody("");
  }

  async function save() {
    setPending(true);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/notes`, "POST", { body });
      if (!res.ok) {
        toast.error("Note not saved. Try again.");
        return;
      }
      cancel();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Internal notes" className="flex flex-col gap-3 rounded-md border border-border bg-white p-5">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-subsection">Internal notes. Never sent to the {partner ? "partner" : "customer"}</h2>
        {!adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Add note
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-1" data-testid="note-composer">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_BODY} placeholder="New internal note" aria-label="New internal note" rows={3} autoFocus />
          <span className="self-end text-meta text-text-secondary">{body.length} / {MAX_BODY.toLocaleString("en-GB")}</span>
          <div className="flex items-center gap-2">
            <Button disabled={body.trim().length === 0} loading={pending} onClick={() => void save()}>
              Save
            </Button>
            <Button variant="text" onClick={cancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {people.length === 0 ? (
        <p className="text-meta text-text-secondary">No notes yet. Notes are internal and visible to all teams.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {people.map((n) => (
            <div key={n.id} data-testid="note-row" className="flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-tint-strong text-primary" aria-hidden="true">
                <StickyNote className="size-3.5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="text-meta text-text-secondary">
                  <span className="font-medium">{n.authorName}</span>
                  {n.authorTeam && ` · ${TEAM_LABELS[n.authorTeam as keyof typeof TEAM_LABELS]}`} · {formatInZone(n.createdAt, viewerZone)}
                </div>
                <p className="whitespace-pre-line text-body text-text">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
