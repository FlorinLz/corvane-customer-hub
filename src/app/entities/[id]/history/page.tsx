import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AddNoteDrawer } from "@/components/entity/history/AddNoteDrawer";
import { formatDate, toLocalDate, today } from "@/lib/dates";
import { NOTE_TYPE_LABELS, TEAM_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/server/session";
import { effectiveTimeZone, formatDateTime } from "@/lib/time-zones";
import { historySummary } from "@/lib/time-correction";
import { loadHistoryData, type HistoryItem } from "@/server/queries/history";
import { loadActiveContactNames } from "@/server/queries/contacts";
import { loadActiveUsers } from "@/server/queries/users";

type NoteWithRelations = Extract<HistoryItem, { kind: "note" }>["note"];
type NoteParticipant = NoteWithRelations["participants"][number];

function participantLabel(p: NoteParticipant) {
  const name = p.nameSnapshot;
  if (p.kind === "CONTACT" && p.contact?.status === "LEFT") return `${name} (Former contact)`;
  if (p.kind === "USER" && p.user && !p.user.active) return `${name} (Inactive user)`;
  return name;
}

function EventCard({ event, zone }: { event: Extract<HistoryItem, { kind: "event" }>["event"]; zone: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
      <Clock3 className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="text-body">{historySummary(event, zone)}</p>
        <div className="flex flex-wrap items-center gap-2 text-meta text-text-secondary">
          {event.actorName && <span>{event.actorName}</span>}
          {event.actorTeam && <span>· {TEAM_LABELS[event.actorTeam]}</span>}
          <span>· {formatDateTime(event.createdAt, zone)}</span>
          {event.handoffId && (
            <Link href={`/handoffs/${event.handoffId}`} className="text-link-text hover:underline">
              View handoff summary
            </Link>
          )}
          {event.issueId && (
            <Link href={`/issues/${event.issueId}`} className="text-link-text hover:underline">
              View issue
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, zone }: { note: Extract<HistoryItem, { kind: "note" }>["note"]; zone: string }) {
  const openOverdue = (item: (typeof note.actionItems)[number]) => item.status === "OPEN" && toLocalDate(item.dueDate) < today();
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="selected">{NOTE_TYPE_LABELS[note.type]}</Badge>
        <span className="text-meta text-text-secondary">
          {note.author.name} · {TEAM_LABELS[note.authorTeam]}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-meta text-text-secondary">
        <span>Interaction on {formatDate(toLocalDate(note.interactionDate))}</span>
        <span>Added {formatDateTime(note.createdAt, zone)}</span>
        {note.editedAt && <span>Edited {formatDateTime(note.editedAt, zone)}</span>}
      </div>
      {note.participants.length > 0 && (
        <p className="mb-2 text-meta text-text-secondary">
          Participants: {note.participants.map((p) => participantLabel(p)).join(", ")}
        </p>
      )}
      <p className="whitespace-pre-line text-body">{note.summary}</p>
      {note.actionItems.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
          {note.actionItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-meta">
              <input type="checkbox" checked={item.status === "DONE"} disabled className="mt-0.5" aria-label={item.description} />
              <div className="flex flex-col">
                <span className="text-body text-text">
                  {item.description} · {item.owner.name} · Due {formatDate(toLocalDate(item.dueDate))}
                </span>
                <span className={openOverdue(item) ? "text-danger" : "text-text-secondary"}>
                  {item.status === "DONE"
                    ? `Done by ${item.statusChangedBy?.name ?? item.owner.name}${item.statusChangedAt ? ` on ${formatDate(toLocalDate(item.statusChangedAt))}` : ""}`
                    : openOverdue(item)
                      ? "Overdue"
                      : "Open"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [data, users, contacts, viewer] = await Promise.all([loadHistoryData(id, page), loadActiveUsers(), loadActiveContactNames(id), getCurrentUser()]);
  const zone = effectiveTimeZone(viewer);
  if (!data) notFound();

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-meta text-text-secondary">No history yet. Add the first note to start the shared history.</p>
        <AddNoteDrawer entityId={id} users={users} contacts={contacts} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-meta text-text-secondary">{data.total} item{data.total === 1 ? "" : "s"}</p>
        <AddNoteDrawer entityId={id} users={users} contacts={contacts} />
      </div>
      <div>
        {data.items.map((item) =>
          item.kind === "note" ? <NoteCard key={item.id} note={item.note} zone={zone} /> : <EventCard key={item.id} event={item.event} zone={zone} />,
        )}
      </div>
      {data.hasMore && (
        <Link href={`?page=${page + 1}`} className="self-start text-meta text-link-text hover:underline">
          Load more
        </Link>
      )}
    </div>
  );
}
