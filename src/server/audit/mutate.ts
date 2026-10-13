import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { AuditObjectType, HistoryCategory, Prisma, AuditSource } from "@prisma/client";

import { db } from "@/server/db";
import { TRANSACTION_OPTIONS } from "@/server/config";
import { now } from "@/lib/dates";
import { recordFields, recordFieldsMany, type AuditFieldChange, type AuditActor } from "@/server/audit/record";
import { addHistory, addHistoryMany } from "@/server/audit/history";
import type { SessionUser } from "@/server/permissions/can";

export interface AuditLogger {
  /** One AuditEntry per changed field; skips fields where old === new (recordFields already does this via its caller). Always await this — it queries the shared transaction client. */
  change(c: {
    objectType: AuditObjectType;
    objectId: string;
    objectLabel: string;
    fields: AuditFieldChange[];
    reason?: string;
    source?: AuditSource;
  }): Promise<void>;
  /** Zero or one History event per user action. Always await this — it queries the shared transaction client. */
  history(e: { category: HistoryCategory; summary: string; details?: Prisma.InputJsonValue; handoffId?: string; issueId?: string }): Promise<void>;
  /** `change()` for several objects in ONE insert: use it instead of calling `change()` in a loop (one round trip, not one per object). */
  changes(items: { objectType: AuditObjectType; objectId: string; objectLabel: string; fields: AuditFieldChange[]; reason?: string; source?: AuditSource }[]): Promise<void>;
  /** `history()` for several events in ONE insert: use it instead of calling `history()` in a loop. */
  histories(items: { category: HistoryCategory; summary: string; handoffId?: string; issueId?: string }[]): Promise<void>;
}

/**
 * Brief 4.2.1 "one service layer, one transaction": every write opens one
 * Prisma interactive transaction, runs the change, writes the audit
 * entries and the History event (if any) in the same transaction. If
 * anything throws, nothing is written (M16 AC1).
 *
 * `fn` must await every `log.change()` / `log.history()` call: they query
 * the same transaction client as the rest of `fn`, which Prisma requires
 * to be used sequentially, not concurrently.
 *
 * `fn`'s third argument is the same demo-clock instant used for this
 * transaction's own audit/history rows -- reuse it for any other row `fn`
 * creates directly (e.g. `StageEvent`, `CoverageStatusChange`) instead of
 * calling `now()` again, so every row this transaction writes shares one
 * instant and never relies on `@default(now())`.
 */
export async function mutate<T>(
  user: SessionUser,
  ctx: { entityId: string | null; groupId?: string },
  fn: (tx: Prisma.TransactionClient, log: AuditLogger, now: Date) => Promise<T>,
): Promise<T> {
  const actionId = randomUUID();
  const actor: AuditActor = { userId: user.id, userName: user.name, userTeam: user.team };
  // One instant for every audit/history row this transaction writes, from
  // the demo clock, never the database's own @default(now()) (real time).
  const t = now();

  return db.$transaction(async (tx) => {
    const log: AuditLogger = {
      change: (c) =>
        recordFields(tx, {
          actionId,
          entityId: ctx.entityId ?? undefined,
          groupId: ctx.groupId,
          objectType: c.objectType,
          objectId: c.objectId,
          objectLabel: c.objectLabel,
          fields: c.fields,
          actor,
          source: c.source,
          reason: c.reason,
          createdAt: t,
        }),
      history: (e) => {
        if (!ctx.entityId) return Promise.resolve();
        return addHistory(tx, {
          entityId: ctx.entityId,
          category: e.category,
          summary: e.summary,
          details: e.details,
          actionId,
          handoffId: e.handoffId,
          issueId: e.issueId,
          actorId: user.id,
          actorName: user.name,
          actorTeam: user.team,
          createdAt: t,
        });
      },
      changes: (items) =>
        recordFieldsMany(
          tx,
          items.map((c) => ({
            actionId,
            entityId: ctx.entityId ?? undefined,
            groupId: ctx.groupId,
            objectType: c.objectType,
            objectId: c.objectId,
            objectLabel: c.objectLabel,
            fields: c.fields,
            actor,
            source: c.source,
            reason: c.reason,
            createdAt: t,
          })),
        ),
      histories: (items) => {
        const entityId = ctx.entityId;
        if (!entityId) return Promise.resolve();
        return addHistoryMany(
          tx,
          items.map((e) => ({
            entityId,
            category: e.category,
            summary: e.summary,
            actionId,
            handoffId: e.handoffId,
            issueId: e.issueId,
            actorId: user.id,
            actorName: user.name,
            actorTeam: user.team,
            createdAt: t,
          })),
        );
      },
    };
    return fn(tx, log, t);
  }, TRANSACTION_OPTIONS).then((result) => {
    // Brief 4.6.1, M11 AC20: "every write calls revalidatePath('/')" so a
    // resolved worklist item is gone on return without a manual reload.
    // One place for every write in the app, rather than touching each
    // service individually. Guarded: revalidatePath() requires a real
    // Next.js request's static-generation store, which unit tests that
    // call these services directly never have ("Invariant: static
    // generation store missing") -- same shape as DegradedProposalBanner's
    // sessionStorage guard, a runtime API not always available in the
    // current execution context.
    try {
      revalidatePath("/");
    } catch {
      // not running inside a Next.js request (e.g. a unit test) -- nothing to revalidate
    }
    return result;
  });
}
