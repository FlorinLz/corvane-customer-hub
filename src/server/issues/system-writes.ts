import type { Prisma } from "@prisma/client";

import { db } from "@/server/db";
import { TRANSACTION_OPTIONS } from "@/server/config";
import { now as nowFn } from "@/lib/dates";
import { userCalendar } from "@/lib/business-hours";
import { formatInZone } from "@/lib/time-zones";
import { recordFields, createFields } from "@/server/audit/record";
import { addHistory } from "@/server/audit/history";
import { COMMUNICATION_CHANNEL_LABELS, COMMUNICATION_TYPE_LABELS, issueDisplayId } from "@/lib/labels";

// Brief 4.9.1, 4.9.7. The idempotent on-read system write for the
// hand-over (rules 3, 3b). Runs in its own short transaction, separate
// from the caller's own mutate() transaction: a unique-constraint
// rollback here must never abort an unrelated write. Call before
// opening the Issue page's data loader and at the start of every
// issue-write service (brief: "runs at the start of ... every issue
// write"); the queued-with-no-named-person write (M18 AC6) and R2
// automatic closes are out of 6B's scope (the seed always has a named
// person per team, and automatic closes are milestone 12A).

const SYSTEM_ACTOR = { userId: null, userName: "Customer Hub", userTeam: null } as const;

function isUniqueConstraintViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "P2002";
}

/** "<type> by <channel> to <person> at <time> by <recorder>", the hand-over note's "Already communicated" list (4.9.7). */
async function communicatedBeforeHandover(tx: Prisma.TransactionClient, issueId: string, handoverAt: Date, zone: string): Promise<string[]> {
  const rows = await tx.issueCommunication.findMany({
    where: { issueId, type: { in: ["FIRST_NOTIFICATION", "UPDATE"] }, occurredAt: { lte: handoverAt } },
    orderBy: { occurredAt: "asc" },
  });
  return rows.map(
    (r) =>
      `${COMMUNICATION_TYPE_LABELS[r.type]} by ${r.channel ? COMMUNICATION_CHANNEL_LABELS[r.channel] : "—"} to ${r.personName ?? "—"} at ${formatInZone(r.occurredAt, zone)} by ${r.recordedByName}`,
  );
}

/** Brief 4.9.7 "Hand-over". Idempotent via IssueCommunication.systemKey's unique constraint. */
export async function ensureSystemWrites(issueId: string, now: Date = nowFn()): Promise<void> {
  const issue = await db.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      number: true,
      entityId: true,
      ownerId: true,
      communicatorRule: true,
      handoverAt: true,
      handoverWrittenAt: true,
      notifyRequired: true,
      notifyDueAt: true,
      notifiedAt: true,
      entity: { select: { ownerId: true, owner: { select: { id: true, name: true, timeZone: true, team: true } } } },
      owner: { select: { name: true } },
    },
  });
  if (!issue) return;
  if (issue.communicatorRule !== "ISSUE_OWNER_UNTIL_HANDOVER" || !issue.handoverAt || issue.handoverAt > now || issue.handoverWrittenAt) return;
  const customerOwner = issue.entity.owner;
  if (!customerOwner) return; // no customer owner to hand over to yet

  const zone = userCalendar(customerOwner).timeZone;
  const handoverTime = formatInZone(issue.handoverAt, zone);
  const entries = await communicatedBeforeHandover(db, issue.id, issue.handoverAt, zone);
  let text = `Communication handed over to ${customerOwner.name} at ${handoverTime}. Already communicated: ${entries.length > 0 ? `${entries.join("; ")}.` : "nothing yet."}`;
  if (issue.notifyRequired && !issue.notifiedAt && issue.notifyDueAt) {
    text += ` Notify customer was due ${formatInZone(issue.notifyDueAt, zone)}.`;
  }
  text += ` Owner: ${issue.owner?.name ?? "—"}.`;

  const systemKey = `handover:${issue.id}`;
  try {
    await db.$transaction(async (tx) => {
      await tx.issueCommunication.create({
        data: { issueId: issue.id, type: "SYSTEM", occurredAt: issue.handoverAt!, message: text, recordedByName: "Customer Hub", systemKey, createdAt: now },
      });
      await tx.issueNote.create({
        data: { issueId: issue.id, kind: "SYSTEM", body: text, authorName: "Customer Hub", createdAt: now },
      });
      await tx.issue.update({ where: { id: issue.id }, data: { handoverWrittenAt: now } });

      const actionId = systemKey;
      await recordFields(tx, {
        actionId,
        entityId: issue.entityId,
        objectType: "ISSUE",
        objectId: issue.id,
        objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
        fields: createFields({ Communicator: customerOwner.name }),
        actor: SYSTEM_ACTOR,
        source: "SYSTEM_ISSUE",
        createdAt: now,
      });
      await addHistory(tx, {
        entityId: issue.entityId,
        category: "INCIDENT",
        summary: `${issueDisplayId(issue.number)}: communication handed over to ${customerOwner.name} at ${handoverTime}`,
        actionId,
        issueId: issue.id,
        actorName: "Customer Hub",
        createdAt: now,
      });
    }, TRANSACTION_OPTIONS);
  } catch (err) {
    if (isUniqueConstraintViolation(err)) return; // another request already wrote it
    throw err;
  }
}
