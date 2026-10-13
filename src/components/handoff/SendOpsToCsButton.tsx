"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ContactRole } from "@prisma/client";

import { apiGet, apiRequest } from "@/lib/api-client";
import { BLOCKED_BY_LABELS, CONTACT_ROLE_LABELS, SCHEME_LABELS, STAGE_LABELS } from "@/lib/labels";
import { contactOwnerTeams } from "@/server/derived/contact-ownership";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DrawerContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpsToCsContext } from "@/server/queries/handoff-ops-to-cs-context";
import { FieldError } from "@/components/ui/field-error";

interface Commitment {
  description: string;
  dueDate: string;
}

/** Brief 3.8.2 "Hand over to Customer Success", S6 View B, M8 AC1-AC9. Ops only. */
export function SendOpsToCsButton({ entityId, hasEligibleProduct, hasOpenHandoff }: { entityId: string; hasEligibleProduct: boolean; hasOpenHandoff: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [context, setContext] = React.useState<OpsToCsContext | null>(null);
  const [blockNotes, setBlockNotes] = React.useState<Record<string, string>>({});
  const [commitments, setCommitments] = React.useState<Commitment[]>([]);
  const [noOpenCommitments, setNoOpenCommitments] = React.useState(false);
  const [confirmedContactIds, setConfirmedContactIds] = React.useState<Set<string>>(new Set());
  const [csmId, setCsmId] = React.useState("");
  const [noteForCsm, setNoteForCsm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void apiGet<OpsToCsContext>(`/api/entities/${entityId}/handoffs/ops-to-cs-context`).then((res) => {
      if (cancelled || !res.ok) return;
      setContext(res.data);
      setBlockNotes({});
      setCommitments([]);
      setNoOpenCommitments(false);
      setConfirmedContactIds(new Set());
      setCsmId("");
      setNoteForCsm("");
      setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, entityId]);

  const openBlocks = context?.products.filter((p) => p.blockedBy) ?? [];

  async function send() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/entities/${entityId}/handoffs/ops-to-cs`, "POST", {
        blockNotes,
        commitments: noOpenCommitments ? [] : commitments.filter((c) => c.description.trim().length > 0),
        noOpenCommitments,
        confirmedContactIds: Array.from(confirmedContactIds),
        onboardingManagerId: csmId,
        noteForCsm: noteForCsm || null,
      });
      if (!res.ok) {
        setError(res.kind === "validation" ? Object.values(res.fieldErrors)[0]?.[0] ?? "Handoff not sent. Try again." : res.kind === "conflict" ? res.message : "Handoff not sent. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Handoff sent");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = csmId.length > 0 && (noOpenCommitments || commitments.some((c) => c.description.trim().length >= 5)) && openBlocks.every((b) => (blockNotes[b.id] ?? "").trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        disabled={!hasEligibleProduct || hasOpenHandoff}
        title={!hasEligibleProduct ? "Available when at least one product has completed hypercare" : hasOpenHandoff ? "A handoff is already pending" : undefined}
        onClick={() => setOpen(true)}
      >
        Hand over to Customer Success
      </Button>
      <DrawerContent width={640}>
        <DialogHeader>Hand over to Customer Success</DialogHeader>
        <DialogBody>
          {!context ? (
            <p className="text-meta text-text-secondary">Loading…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-subsection">Product stages</h3>
                <ul className="flex flex-col gap-1 text-body">
                  {context.products.map((p) => (
                    <li key={p.id}>{SCHEME_LABELS[p.product]} / {p.country} · {STAGE_LABELS[p.stage]}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="text-subsection">Open blocks</h3>
                {openBlocks.length === 0 ? (
                  <p className="text-meta text-text-secondary">No open blocks</p>
                ) : (
                  openBlocks.map((b) => (
                    <div key={b.id} className="flex flex-col gap-1">
                      <label htmlFor={`block-note-${b.id}`} className="text-meta text-text-secondary">
                        {SCHEME_LABELS[b.product]} / {b.country} · Blocked by {BLOCKED_BY_LABELS[b.blockedBy!]}: {b.blockedReason}
                      </label>
                      <Textarea
                        id={`block-note-${b.id}`}
                        value={blockNotes[b.id] ?? ""}
                        onChange={(e) => setBlockNotes((n) => ({ ...n, [b.id]: e.target.value.slice(0, 300) }))}
                        maxLength={300}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="text-subsection">Commitments to the customer</h3>
                <label className="flex items-center gap-2 text-body">
                  <Checkbox checked={noOpenCommitments} onChange={(e) => setNoOpenCommitments(e.target.checked)} />
                  No open commitments
                </label>
                {!noOpenCommitments && (
                  <div className="flex flex-col gap-2">
                    {commitments.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          aria-label={`Commitment ${i + 1} description`}
                          className="flex-1 rounded-sm border border-border-strong px-2 py-1.5 text-body"
                          value={c.description}
                          onChange={(e) => setCommitments((cs) => cs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                        />
                        <input
                          aria-label={`Commitment ${i + 1} due date`}
                          type="date"
                          className="rounded-sm border border-border-strong px-2 py-1.5 text-body"
                          value={c.dueDate}
                          onChange={(e) => setCommitments((cs) => cs.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))}
                        />
                      </div>
                    ))}
                    <Button variant="secondary" onClick={() => setCommitments((cs) => [...cs, { description: "", dueDate: "" }])}>
                      Add commitment
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="text-subsection">Confirmed contacts</h3>
                {!context.hasActiveIncidentContact && <FieldError>Add an active incident contact before handing over</FieldError>}
                {!context.hasActiveChampion && <p className="text-meta text-due">No active champion. The CSM will need to identify one</p>}
                {context.contacts.map((c) => {
                  const ownsIt = contactOwnerTeams("CUSTOMER", c.role as ContactRole).includes("OPS");
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-body">
                      {ownsIt ? (
                        <Checkbox
                          checked={confirmedContactIds.has(c.id)}
                          onChange={(e) => setConfirmedContactIds((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                        />
                      ) : (
                        <span className="size-4" />
                      )}
                      <span>{c.fullName} ({CONTACT_ROLE_LABELS[c.role]}) · {c.email}{!ownsIt ? ` · Last verified ${c.lastVerifiedAt ?? "never"}` : ""}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="ops-cs-csm" className="text-meta text-text-secondary">Receiving CSM</label>
                <Select value={csmId} onValueChange={setCsmId}>
                  <SelectTrigger id="ops-cs-csm" aria-label="Receiving CSM">
                    <SelectValue placeholder="Select a CSM" />
                  </SelectTrigger>
                  <SelectContent>
                    {context.csUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="ops-cs-note" className="text-meta text-text-secondary">Note for the CSM (optional)</label>
                <Textarea id="ops-cs-note" value={noteForCsm} onChange={(e) => setNoteForCsm(e.target.value.slice(0, 1000))} maxLength={1000} />
              </div>

              {error && <FieldError>{error}</FieldError>}
            </>
          )}
        </DialogBody>
        <DialogFooter reason={!context || valid ? null : !openBlocks.every((b) => (blockNotes[b.id] ?? "").trim().length > 0) ? "Add a note on each open block" : !noOpenCommitments && !commitments.some((c) => c.description.trim().length >= 5) ? "Add a commitment or tick No open commitments" : "Choose the receiving CSM"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!context || !valid} loading={pending} onClick={() => void send()}>
            Send handoff
          </Button>
        </DialogFooter>
      </DrawerContent>
    </Dialog>
  );
}
