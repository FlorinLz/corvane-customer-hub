"use client";

import * as React from "react";
import { Info, Mail } from "lucide-react";

import { COMMUNICATION_CHANNEL_LABELS, COMMUNICATION_TYPE_LABELS } from "@/lib/labels";
import { formatInZone } from "@/lib/time-zones";

export interface CommunicationLogEntry {
  id: string;
  type: string;
  occurredAt: Date;
  channel: string | null;
  personName: string | null;
  message: string;
  recordedByName: string;
}

const PREVIEW_LINES = 3;

function Icon({ system }: { system: boolean }) {
  const Glyph = system ? Info : Mail;
  return (
    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-tint-strong text-primary" aria-hidden="true">
      <Glyph className="size-3.5" />
    </span>
  );
}

function Entry({ entry, zone }: { entry: CommunicationLogEntry; zone: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const system = entry.type === "SYSTEM";
  const lines = entry.message.split("\n");
  const long = !system && (lines.length > PREVIEW_LINES || entry.message.length > 400);
  const shown = long && !expanded ? lines.slice(0, PREVIEW_LINES).join("\n") : entry.message;
  const when = formatInZone(entry.occurredAt, zone);

  return (
    <div data-testid="comm-log-entry" data-type={entry.type} className="flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3">
      <Icon system={system} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {system ? (
          <div className="text-meta text-text-secondary">
            <span className="font-medium">Customer Hub</span> · {when}
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-body font-semibold text-text">{COMMUNICATION_TYPE_LABELS[entry.type as keyof typeof COMMUNICATION_TYPE_LABELS]}</span>
            <span className="text-meta text-text-secondary">
              {when}
              {entry.channel && ` · ${COMMUNICATION_CHANNEL_LABELS[entry.channel as keyof typeof COMMUNICATION_CHANNEL_LABELS]}`}
              {entry.personName && ` · ${entry.personName}`} · Recorded by {entry.recordedByName}
            </span>
          </div>
        )}
        <p className="whitespace-pre-line text-body text-text">{shown}</p>
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="self-start text-body text-link-text hover:underline">
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

/** "Communication log. Messages exchanged with the customer" ("the partner" on a partner issue), one tinted row per entry (mail icon for messages, info icon for system entries). */
export function CommunicationLogCard({ log, viewerZone, partner = false }: { log: CommunicationLogEntry[]; viewerZone: string; partner?: boolean }) {
  return (
    <section aria-label="Communication log" data-onboarding="communication-log" className="flex flex-col gap-3 rounded-md border border-border bg-white p-5">
      <h2 className="text-subsection">Communication log. Messages exchanged with the {partner ? "partner" : "customer"}</h2>
      {log.length === 0 ? (
        <p className="text-meta text-text-secondary">No communication recorded yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {log.map((e) => (
            <Entry key={e.id} entry={e} zone={viewerZone} />
          ))}
        </div>
      )}
    </section>
  );
}
