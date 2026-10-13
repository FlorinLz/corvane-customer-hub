import type { HistoryCategory, Prisma, Team } from "@prisma/client";

/**
 * Brief 3.2.4 "History": written in the same transaction as the audit entries,
 * sharing actionId. `createdAt` is required (not left to the schema's own
 * @default(now()), which reads the database's real clock, not the demo
 * clock) -- every caller must pass the same `now()` instant already in
 * scope for the rest of its own write.
 */
export async function addHistory(
  tx: Prisma.TransactionClient,
  params: {
    entityId: string;
    category: HistoryCategory;
    summary: string;
    details?: Prisma.InputJsonValue;
    actionId: string;
    handoffId?: string;
    issueId?: string;
    actorId?: string | null;
    actorName: string;
    actorTeam?: Team | null;
    createdAt: Date;
  },
): Promise<void> {
  await tx.historyEvent.create({
    data: {
      entityId: params.entityId,
      category: params.category,
      summary: params.summary,
      details: params.details,
      actionId: params.actionId,
      handoffId: params.handoffId,
      issueId: params.issueId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorTeam: params.actorTeam,
      createdAt: params.createdAt,
    },
  });
}

/** Several `addHistory()` events in ONE insert: one round trip however many events. */
export async function addHistoryMany(tx: Prisma.TransactionClient, events: Parameters<typeof addHistory>[1][]): Promise<void> {
  if (events.length === 0) return;
  await tx.historyEvent.createMany({
    data: events.map((e) => ({
      entityId: e.entityId,
      category: e.category,
      summary: e.summary,
      details: e.details,
      actionId: e.actionId,
      handoffId: e.handoffId,
      issueId: e.issueId,
      actorId: e.actorId,
      actorName: e.actorName,
      actorTeam: e.actorTeam,
      createdAt: e.createdAt,
    })),
  });
}
