import type { AwarenessSource } from "@prisma/client";

import { teamCalendar, userCalendar } from "@/lib/business-hours";
import { correctionSentence, type CorrectedField } from "@/lib/time-correction";
import type { CorrectTimesInput } from "@/lib/validation/issues";
import { versionConflictMessage } from "@/server/audit/conflict";
import { mutate } from "@/server/audit/mutate";
import { addHistoryMany } from "@/server/audit/history";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertIsOwner, requireIssueEntity } from "@/server/issues/roles";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { checkTimes, recalculateClocks, type ClockPatch } from "@/server/issues/times";
import { issueDisplayId } from "@/lib/labels";
import { randomUUID } from "node:crypto";

/**
 * Times rule 5: "Correct times", owner only, on standalone and partner issues. Event, Corvane aware at and Source change
 * together with a reason. Open deadlines are recalculated from the corrected Corvane aware at; deadlines already met stay
 * met; clocks of resolved issues do not change. Issues created from a partner issue inherit the corrected values, and
 * have no Correct times of their own. One IssueTimeCorrection row and one audit entry per changed field.
 */
export async function correctIssueTimes(user: Parameters<typeof requireIssueEntity>[1], issueId: string, input: CorrectTimesInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log, t) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));

    const asChild = await tx.issueLink.findFirst({ where: { childId: issue.id, kind: "CREATED", unlinkedAt: null }, select: { parent: { select: { number: true } } } });
    if (asChild) throw new ValidationError({ times: [`Times come from ${issueDisplayId(asChild.parent.number)}`] });
    await assertIsOwner(tx, issue, user);

    const nextEvent = input.eventAt === undefined ? issue.eventAt : input.eventAt ? new Date(input.eventAt) : null;
    const nextAware = input.awareAt ? new Date(input.awareAt) : issue.awareAt;
    const nextSource: AwarenessSource = input.awarenessSource ?? issue.awarenessSource;

    const changes: { field: CorrectedField; oldValue: string | null; newValue: string | null }[] = [];
    if ((nextEvent?.getTime() ?? null) !== (issue.eventAt?.getTime() ?? null)) {
      changes.push({ field: "EVENT_AT", oldValue: issue.eventAt?.toISOString() ?? null, newValue: nextEvent?.toISOString() ?? null });
    }
    if (nextAware.getTime() !== issue.awareAt.getTime()) {
      if (issue.reporterKind === "MONITORING") throw new ValidationError({ awareAt: ["Corvane aware at is the alert time on a monitoring issue and can't be corrected"] });
      changes.push({ field: "AWARE_AT", oldValue: issue.awareAt.toISOString(), newValue: nextAware.toISOString() });
    }
    if (nextSource !== issue.awarenessSource) changes.push({ field: "AWARENESS_SOURCE", oldValue: issue.awarenessSource, newValue: nextSource });
    if (changes.length === 0) throw new ValidationError({ times: ["Change at least one time or the source"] });

    const errors = checkTimes({ eventAt: nextEvent, awareAt: nextAware, openedAt: issue.createdAt, now: t });
    if (errors.eventAt || errors.awareAt) throw new ValidationError(Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])));

    const awareChanged = changes.some((c) => c.field === "AWARE_AT");

    // Clocks: the parent's own, then each linked issue's (inherited values, notification clock only).
    let patch: ClockPatch = {};
    if (awareChanged) {
      const entity = await tx.entity.findUniqueOrThrow({ where: { id: issue.entityId }, select: { ownerId: true } });
      const communicatorId = effectiveCommunicator(issue, { ownerId: entity.ownerId }, t);
      const [ownerUser, communicator] = await Promise.all([
        issue.ownerId ? tx.user.findUnique({ where: { id: issue.ownerId }, select: { timeZone: true, team: true } }) : null,
        communicatorId ? tx.user.findUnique({ where: { id: communicatorId }, select: { timeZone: true, team: true } }) : null,
      ]);
      patch = recalculateClocks(issue, nextAware, teamCalendar(issue.ownerTeam, ownerUser), communicator ? userCalendar(communicator) : teamCalendar(issue.ownerTeam));
    }

    await tx.issue.update({
      where: { id: issue.id },
      data: { eventAt: nextEvent, awareAt: nextAware, awarenessSource: nextSource, ...patch, version: { increment: 1 } },
    });

    const children = await tx.issue.findMany({
      where: { parentLinks: { some: { parentId: issue.id, kind: "CREATED", unlinkedAt: null } } },
      select: { id: true, number: true, entityId: true, status: true, severity: true, createdAt: true, clocksStartAt: true, ackStartAt: true, acknowledgedAt: true, notifyRequired: true, notifiedAt: true, notifyStartAt: true, notifyDueAt: true, notifyTargetHours: true, notifyTargetBusinessMins: true, ownerTeam: true },
    });
    // Linked issues have no acknowledge clock; their notification start follows the parent. One statement for all of them,
    // plus one per child only where a stored notification due time has to move.
    const inherited = { eventAt: nextEvent, awareAt: nextAware, awarenessSource: nextSource };
    const perChild: { id: string; data: ClockPatch }[] = [];
    if (awareChanged) {
      for (const child of children) {
        const childPatch = recalculateClocks({ ...child, ackStartAt: null }, nextAware, teamCalendar(child.ownerTeam), teamCalendar(child.ownerTeam));
        delete childPatch.ackStartAt;
        delete childPatch.ackDueAt;
        if (child.notifyDueAt === null) delete childPatch.notifyDueAt; // computed on read until a system write stores it
        if (Object.keys(childPatch).length > 0) perChild.push({ id: child.id, data: childPatch });
      }
    }
    if (children.length > 0) {
      await tx.issue.updateMany({ where: { id: { in: children.map((c) => c.id) } }, data: { ...inherited, version: { increment: 1 } } });
      for (const c of perChild) await tx.issue.update({ where: { id: c.id }, data: c.data });
    }

    await tx.issueTimeCorrection.createMany({
      data: changes.map((c) => ({ issueId: issue.id, field: c.field, oldValue: c.oldValue, newValue: c.newValue, reason: input.reason, correctedById: user.id, correctedAt: t })),
    });

    const label = (f: CorrectedField) => (f === "EVENT_AT" ? "Event" : f === "AWARE_AT" ? "Corvane aware at" : "Source");
    const auditFields = (c: (typeof changes)[number]) => ({ field: label(c.field), oldValue: c.oldValue ?? "Unknown", newValue: c.newValue ?? "Unknown" });
    await log.changes([
      { objectType: "ISSUE", objectId: issue.id, objectLabel: `Issue: ${issueDisplayId(issue.number)}`, fields: changes.map(auditFields), reason: input.reason },
      ...children.map((c) => ({ objectType: "ISSUE" as const, objectId: c.id, objectLabel: `Issue: ${issueDisplayId(c.number)}`, fields: changes.map(auditFields), reason: `Corrected on ${issueDisplayId(issue.number)}: ${input.reason}` })),
    ]);

    // History: one event per changed field, stored in UTC with the raw values in `details`, shown in the reader's zone (src/lib/time-correction.ts).
    const actionId = randomUUID();
    await addHistoryMany(
      tx,
      changes.flatMap((c) => {
        const details = { kind: "TIME_CORRECTION", field: c.field, oldValue: c.oldValue, newValue: c.newValue, by: user.name, reason: input.reason };
        return [issue, ...children].map((i) => ({
          entityId: i.entityId,
          category: "INCIDENT" as const,
          summary: correctionSentence(details, "UTC"),
          details,
          actionId,
          issueId: i.id,
          actorId: user.id,
          actorName: user.name,
          actorTeam: user.team,
          createdAt: t,
        }));
      }),
    );
    return { id: issue.id, number: issue.number };
  });
}
