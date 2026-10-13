import Link from "next/link";

import { spanText, timelineText } from "@/lib/time-block";
import { AWARENESS_SOURCE_LABELS, issueDisplayId } from "@/lib/labels";
import { CORRECTED_FIELD_LABELS, correctionValueText, type CorrectedField } from "@/lib/time-correction";
import { formatInZone } from "@/lib/time-zones";
import type { AwarenessSource, Severity } from "@prisma/client";

/** The amber marker shows only when Opened is more than this long after Corvane aware at, on a Sev-1 or Sev-2 issue (times rule 8). */
export const OPENED_GAP_MINUTES = 30;

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-t border-border py-1.5 text-body first:border-t-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-text" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

/** The customer's or partner's name: a link to the company page (Overview), like the "Linked issue" link; plain text when the viewer has no access. */
function EntityName({ name, href, bold = false }: { name: string; href: string | null; bold?: boolean }) {
  if (!href) return <span className={bold ? "font-semibold" : undefined}>{name}</span>;
  return (
    <Link href={href} className={`text-link-text hover:underline${bold ? " font-semibold" : ""}`}>
      {name}
    </Link>
  );
}

function Secondary({ children }: { children: React.ReactNode }) {
  return <span className="block text-meta text-text-secondary">{children}</span>;
}

export interface AboutAndTimelineProps {
  /** "Customer" on a customer issue; "Partner" on the partner issue itself (the entity is the partner). */
  entityRole: "Customer" | "Partner";
  entityName: string;
  /** The entity's Overview page; null when the viewer cannot open it (a deleted record, for anyone but the admin): plain text then. */
  entityHref: string | null;
  product: string | null;
  impact: string;
  linkedParent: { id: string; number: number; entityName: string; entityHref: string | null } | null;
  timeline: {
    /** Event: when the problem started. null = Unknown. */
    eventAt: Date | null;
    awareAt: Date;
    source: AwarenessSource;
    severity: Severity;
    openedAt: Date;
    /** The latest correction (who, when) and the original values of every corrected field. */
    correction: { byName: string; at: Date; originals: { field: string; value: string | null }[] } | null;
    reportedBy: string;
    reportedAtCustomerBy: string | null;
    acknowledged: { byName: string | null; at: Date; via: number | null } | null;
    resolved: { byName: string | null; at: Date; via: number | null } | null;
    /** A linked issue's times are its partner issue's: "Times from ISS-1045". */
    timesFrom: { id: string; number: number } | null;
  };
  /** The "Correct times" link (owner only, standalone and partner issues); the dialog is built by the page. */
  correctLink?: React.ReactNode;
  zone: string;
  serverNow: Date;
}

/**
 * "About this issue" beside "Timeline". Static for the life of the page load: times are the viewer's zone, with the
 * label, read once from the server demo clock (they are things that happened, not countdowns). Only the fields main has: Corvane aware at,
 * Issue opened, Reported by, Reported at the customer by, Acknowledged and Resolved (Event, Source and Correct times come with the next PR).
 */
export function AboutAndTimeline({ entityRole, entityName, entityHref, product, impact, linkedParent, timeline, correctLink, zone, serverNow }: AboutAndTimelineProps) {
  const t = (d: Date) => timelineText(d, serverNow, zone);
  // "Via ISS-1045 by Lukas Brenner at Mon 05 Oct, 10:21 CEST" on a linked issue, "Kevin Lim at Mon 05 Oct, 10:21 CEST" otherwise.
  const evidence = (e: { byName: string | null; at: Date; via: number | null }) => `${e.via ? `Via ${issueDisplayId(e.via)} by ` : ""}${e.byName ?? "—"} at ${t(e.at)}`;
  const gapMinutes = Math.floor((timeline.openedAt.getTime() - timeline.awareAt.getTime()) / 60_000);
  const showGap = gapMinutes > OPENED_GAP_MINUTES && (timeline.severity === "SEV1" || timeline.severity === "SEV2");
  const sevNumber = timeline.severity === "SEV1" ? 1 : 2;
  const c = timeline.correction;
  const correctedAt = c ? formatInZone(c.at, zone) : "";
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-4 border-b border-border pb-5 min-[1101px]:grid-cols-2">
      <section aria-label="About this issue">
        <h2 className="mb-1 text-[12px] uppercase tracking-[0.06em] text-text-secondary">About this issue</h2>
        <dl>
          <Row label={entityRole}>
            <EntityName name={entityName} href={entityHref} bold />
          </Row>
          {product && <Row label="Product">{product}</Row>}
          <Row label="Impact">{impact}</Row>
          {linkedParent && (
            <>
              <Row label="Linked issue">
                <Link href={`/issues/${linkedParent.id}`} className="text-link-text hover:underline">
                  {issueDisplayId(linkedParent.number)}
                </Link>
              </Row>
              <Row label="Partner">
                <EntityName name={linkedParent.entityName} href={linkedParent.entityHref} /> (partner outage)
              </Row>
            </>
          )}
        </dl>
      </section>

      <section aria-label="Timeline">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-[12px] uppercase tracking-[0.06em] text-text-secondary">Timeline</h2>
          {timeline.timesFrom ? (
            <span className="text-meta text-text-secondary">
              Times from{" "}
              <Link href={`/issues/${timeline.timesFrom.id}`} className="text-link-text hover:underline">
                {issueDisplayId(timeline.timesFrom.number)}
              </Link>
            </span>
          ) : (
            correctLink
          )}
        </div>
        <dl>
          <Row label="Event" testId="timeline-event">
            {timeline.eventAt ? (
              <>
                {t(timeline.eventAt)}
                <Secondary>When the problem started</Secondary>
              </>
            ) : (
              <>
                <span className="text-text-secondary">Unknown</span>
                <Secondary>No event time set</Secondary>
              </>
            )}
          </Row>
          <Row label="Corvane aware at" testId="timeline-aware">
            {t(timeline.awareAt)}
            <Secondary>Source: {AWARENESS_SOURCE_LABELS[timeline.source]}</Secondary>
          </Row>
          <Row label="Issue opened" testId="timeline-opened">
            {t(timeline.openedAt)}
            {showGap && (
              <span className="flex items-center gap-1.5 text-meta text-due" data-testid="timeline-opened-gap">
                <i aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-current" />
                <span className="font-semibold">{spanText(gapMinutes)} after Corvane aware at</span>
                <span className="text-text-secondary">· more than {OPENED_GAP_MINUTES} min on a Sev-{sevNumber} issue</span>
              </span>
            )}
          </Row>
          {c && (
            <Row label="Correction" testId="timeline-correction">
              <span className="group relative inline-block">
                <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-describedby="timeline-correction-tip">
                  Corrected by {c.byName}, {correctedAt}
                </span>
                <span
                  id="timeline-correction-tip"
                  role="tooltip"
                  className="invisible absolute bottom-full left-0 z-10 mb-1 w-max max-w-[320px] rounded-sm bg-primary-dark px-3 py-2 text-meta text-white shadow-lg group-focus-within:visible group-hover:visible"
                >
                  <span className="block font-semibold">Original values</span>
                  {c.originals.map((o) => (
                    <span key={o.field} className="block">
                      {CORRECTED_FIELD_LABELS[o.field as CorrectedField] ?? o.field} {correctionValueText(o.field, o.value, zone)}
                    </span>
                  ))}
                  <span className="block">Corrected {correctedAt}</span>
                </span>
              </span>
            </Row>
          )}
          <Row label="Reported by">{timeline.reportedBy}</Row>
          {timeline.reportedAtCustomerBy && <Row label="Reported at the customer by">{timeline.reportedAtCustomerBy}</Row>}
          {timeline.acknowledged && <Row label="Acknowledged" testId="timeline-acknowledged">{evidence(timeline.acknowledged)}</Row>}
          {timeline.resolved && <Row label="Resolved" testId="timeline-resolved">{evidence(timeline.resolved)}</Row>}
        </dl>
      </section>
    </div>
  );
}
