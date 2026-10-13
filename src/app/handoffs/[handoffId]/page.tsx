import { notFound } from "next/navigation";
import Link from "next/link";

import { getCurrentUser } from "@/server/session";
import { loadHandoffPage } from "@/server/queries/handoff-page";
import { formatDate } from "@/lib/dates";
import { effectiveTimeZone, formatDateTime } from "@/lib/time-zones";
import { HANDOFF_TYPE_LABELS, HANDOFF_STATUS_LABELS, SCHEME_LABELS, STAGE_LABELS, CONTACT_ROLE_LABELS, BLOCKED_BY_LABELS, TEAM_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { ConfirmPickupButton } from "@/components/handoff/ConfirmPickupButton";
import { AcceptHandoffButton } from "@/components/handoff/AcceptHandoffButton";
import type { SalesToOpsSnapshot, OpsToCsSnapshot } from "@/server/services/handoff.types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-subsection">{title}</h3>
      {children}
    </div>
  );
}

function SalesToOpsSummary({ s }: { s: SalesToOpsSnapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Entity">
        <p className="text-body">{s.entity.legalName}</p>
        <p className="text-meta text-text-secondary">LEI {s.entity.lei ?? "Not set"} · {s.entity.country ?? "Not set"} · {s.entity.groupName ? `Group: ${s.entity.groupName}` : "Standalone entity"}</p>
      </Section>
      <Section title="Product lines">
        <ul className="flex flex-col gap-1 text-body">
          {s.products.map((p, i) => (
            <li key={i}>{SCHEME_LABELS[p.product]} / {p.country} · {p.contractingEntityName} · target go-live {formatDate(p.targetGoLive)}</li>
          ))}
        </ul>
      </Section>
      <Section title="Commercial terms">
        <p className="text-body">{s.commercialTerms.currency} {s.commercialTerms.pricePerVerification} per verification · payment term {s.commercialTerms.paymentTermDays} days</p>
        {s.commercialTerms.monthlyMinimum && <p className="text-meta text-text-secondary">Monthly minimum {s.commercialTerms.monthlyMinimum}</p>}
      </Section>
      {(s.slas.availabilityPct || s.slas.maxResponseMs || s.slas.other) && (
        <Section title="Promised SLAs">
          {s.slas.availabilityPct && <p className="text-body">Availability {s.slas.availabilityPct}%</p>}
          {s.slas.maxResponseMs && <p className="text-body">Max response {s.slas.maxResponseMs} ms</p>}
          {s.slas.other && <p className="text-meta text-text-secondary">{s.slas.other}</p>}
        </Section>
      )}
      {s.specialTerms && <Section title="Special terms"><p className="text-body">{s.specialTerms}</p></Section>}
      {s.entitiesNotInPortal && <Section title="Contracted entities not yet in the portal"><p className="text-body">{s.entitiesNotInPortal}</p></Section>}
      <Section title="Initial contacts">
        <ul className="flex flex-col gap-1 text-body">
          {s.contacts.map((c, i) => (
            <li key={i}>{c.fullName} ({CONTACT_ROLE_LABELS[c.role]}) · {c.email}{c.phone ? ` · ${c.phone}` : ""}</li>
          ))}
        </ul>
      </Section>
      {s.notesForOnboarding && <Section title="Notes for Onboarding"><p className="text-body">{s.notesForOnboarding}</p></Section>}
    </div>
  );
}

function OpsToCsSummary({ s }: { s: OpsToCsSnapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Product stages">
        <ul className="flex flex-col gap-1 text-body">
          {s.productStages.map((p, i) => (
            <li key={i}>{SCHEME_LABELS[p.product]} / {p.country} · {STAGE_LABELS[p.stage]} since {formatDate(p.stageEnteredAt)}{p.billableFrom ? ` · Billable from ${formatDate(p.billableFrom)}` : ""}</li>
          ))}
        </ul>
      </Section>
      <Section title="Open blocks">
        {s.openBlocks.length === 0 ? (
          <p className="text-meta text-text-secondary">No open blocks</p>
        ) : (
          <ul className="flex flex-col gap-1 text-body">
            {s.openBlocks.map((b, i) => (
              <li key={i}>
                {SCHEME_LABELS[b.product]} / {b.country} · Blocked by {BLOCKED_BY_LABELS[b.blockedBy as keyof typeof BLOCKED_BY_LABELS]} since {formatDate(b.blockedSince)}: {b.reason}
                <br /><span className="text-meta text-text-secondary">Note: {b.note}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Commitments to the customer">
        {s.commitments === "NONE" ? (
          <p className="text-meta text-text-secondary">No open commitments</p>
        ) : (
          <ul className="flex flex-col gap-1 text-body">
            {s.commitments.map((c, i) => (
              <li key={i}>{c.description}{c.dueDate ? `, due ${formatDate(c.dueDate)}` : ""}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Confirmed contacts">
        <ul className="flex flex-col gap-1 text-body">
          {s.confirmedContacts.map((c, i) => (
            <li key={i}>
              {c.fullName} ({CONTACT_ROLE_LABELS[c.role]}) · {c.email}
              {c.confirmedNow ? <Badge variant="success" className="ml-2">Confirmed</Badge> : c.lastVerifiedAt ? <span className="ml-2 text-meta text-text-secondary">Last verified {formatDate(c.lastVerifiedAt)}</span> : null}
            </li>
          ))}
        </ul>
      </Section>
      {s.noteForCsm && <Section title="Note for the CSM"><p className="text-body">{s.noteForCsm}</p></Section>}
    </div>
  );
}

export default async function HandoffPage({ params }: { params: Promise<{ handoffId: string }> }) {
  const { handoffId } = await params;
  const user = await getCurrentUser();
  const handoff = await loadHandoffPage(handoffId);
  if (!handoff) notFound();

  const isRecipient = handoff.toUser.id === user.id;
  const canAct = isRecipient && handoff.status === "SENT";

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-6 py-6">
      <div className="flex items-center gap-2">
        <h1 className="text-page flex-1">{HANDOFF_TYPE_LABELS[handoff.type]} handoff</h1>
        <Badge variant={handoff.status === "SENT" ? "due" : "success"}>{HANDOFF_STATUS_LABELS[handoff.status]}</Badge>
      </div>
      <p className="text-body text-text-secondary">
        <Link href={`/entities/${handoff.entity.id}/overview`} className="text-link-text hover:underline">{handoff.entity.legalName}</Link>
        {" · "}From {handoff.fromUser.name} ({TEAM_LABELS[handoff.fromUser.team]}) to {handoff.toUser.name} ({TEAM_LABELS[handoff.toUser.team]})
        {" · "}Sent {formatDateTime(handoff.sentAt, effectiveTimeZone(user))}
      </p>

      {handoff.type === "SALES_TO_OPS" ? <SalesToOpsSummary s={handoff.snapshot as SalesToOpsSnapshot} /> : <OpsToCsSummary s={handoff.snapshot as OpsToCsSnapshot} />}

      {canAct && handoff.type === "SALES_TO_OPS" && <ConfirmPickupButton handoffId={handoff.id} />}
      {canAct && handoff.type === "OPS_TO_CS" && <AcceptHandoffButton handoffId={handoff.id} />}
      {!isRecipient && handoff.status === "SENT" && <p className="text-meta text-text-secondary">Only {handoff.toUser.name} can act on this handoff.</p>}
    </div>
  );
}
