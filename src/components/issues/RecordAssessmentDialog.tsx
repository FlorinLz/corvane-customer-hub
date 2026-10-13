"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AssessmentOutcome } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { ASSESSMENT_OUTCOME_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const OUTCOMES: AssessmentOutcome[] = [AssessmentOutcome.POSSIBLE_MAJOR_INCIDENT, AssessmentOutcome.POSSIBLE_DATA_BREACH, AssessmentOutcome.NEITHER];
const MIN_RATIONALE = 10;
const MAX_RATIONALE = 1000;

/** Brief M25 AC6-AC8. Compliance only. */
export function RecordAssessmentDialog({ issueId, triggerVariant = "secondary" }: { issueId: string; triggerVariant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState<AssessmentOutcome>(OUTCOMES[0]);
  const [rationale, setRationale] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const valid = rationale.trim().length >= MIN_RATIONALE && rationale.length <= MAX_RATIONALE;

  function reset() {
    setOutcome(OUTCOMES[0]);
    setRationale("");
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/compliance-assessments`, "POST", { outcome, rationale });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Assessment not saved. Try again.");
        else setError("Assessment not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`${ASSESSMENT_OUTCOME_LABELS[outcome]}. Assessment recorded.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        Record assessment
      </Button>
      <DialogContent>
        <DialogHeader>Record assessment</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Outcome">
            {OUTCOMES.map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-body">
                <input type="radio" name="assessment-outcome" checked={outcome === o} onChange={() => setOutcome(o)} className="size-4 accent-primary" />
                {ASSESSMENT_OUTCOME_LABELS[o]}
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="assessment-rationale" className="text-meta text-text-secondary">Rationale</label>
            <Textarea id="assessment-rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={MAX_RATIONALE} aria-invalid={rationale.length > 0 && rationale.trim().length < MIN_RATIONALE} />
            <span className="self-end text-meta text-text-secondary">{rationale.length} / {MAX_RATIONALE}</span>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : `Write at least ${MIN_RATIONALE} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Save assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
