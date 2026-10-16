import { randomUUID } from "node:crypto";
import { closeWhenAllStepsDone } from "@/server/issues/close-when-done";
import type { Prisma } from "@prisma/client";

import { createFields, recordFieldsMany, type AuditActor } from "@/server/audit/record";
import { addHistoryMany } from "@/server/audit/history";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { now, formatDate, toLocalDate } from "@/lib/dates";
import { addBusinessMinutes, teamCalendar, type Calendar } from "@/lib/business-hours";
import { BUSINESS_DAY_MINUTES, REPORT_DEFAULT_BUSINESS_DAYS } from "@/server/config";
import { effectiveTimeZone, formatInZone } from "@/lib/time-zones";
import { COMMUNICATION_CHANNEL_LABELS, TEAM_LABELS, issueDisplayId } from "@/lib/labels";
import type { ApproveReportInput, RecordReportSentInput, RequestChangesInput, ShareDraftInput } from "@/lib/validation/issues";
import { assertIsOwner, requireIssueEntity } from "@/server/issues/roles";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import type { SessionUser } from "@/server/permissions/can";

// Root cause report task (M27 AC1 to AC7, moved to Release 1 on 08 Oct 2026).
// The task is created inside the transaction that resolves an issue (owner or
// partner cascade); "Record report sent" is an owner-only write of its own.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The task's deadline: resolution time + the card's days, in calendar days of 24 h (M27 AC3). When the card names no period, 10 business days of the
 * owner's calendar (REPORT_DEFAULT_BUSINESS_DAYS; DORA's final report is due at one month).
 */
export function reportDueAt(resolvedAt: Date, reportDays: number | null, ownerCalendar: Calendar): Date {
  return reportDays === null ? addBusinessMinutes(resolvedAt, REPORT_DEFAULT_BUSINESS_DAYS * BUSINESS_DAY_MINUTES, ownerCalendar) : new Date(resolvedAt.getTime() + reportDays * DAY_MS);
}

/**
 * M27 AC1, AC2, AC4. Called by resolveIssue() with the issue and every cascaded child, and the instant of the
 * resolution. A task is created for each issue where ALL hold: severity is Sev-1 at this moment; it is a customer issue
 * (never the partner issue itself); the customer's regime is captured and not None; no task exists yet. The deadline is read
 * once from the Customer agreement card and never changes after (edge case 3). The entity's named Compliance person joins as
 * contributor when not already on the issue. Returns how many tasks were created.
 *
 * Round trips: everything is read in one query per kind (issues, cards, Compliance people) and written in one insert per
 * kind (tasks, contributors, audit, History), however many issues the cascade carries. This runs inside the resolve
 * transaction, which is clocked from its start: per-issue queries here were what pushed a cascade of 3 past Prisma's
 * 5 s default on Neon.
 */
export async function createReportTasksIfDue(
  tx: Prisma.TransactionClient,
  params: { issueIds: string[]; resolvedAt: Date; actor: AuditActor },
): Promise<number> {
  if (params.issueIds.length === 0) return 0;
  const issues = await tx.issue.findMany({
    where: { id: { in: params.issueIds } },
    select: {
      id: true,
      number: true,
      entityId: true,
      severity: true,
      ownerId: true,
      ownerTeam: true,
      owner: { select: { timeZone: true, team: true } },
      communicatorRule: true,
      contributors: { where: { removedAt: null }, select: { userId: true } },
      rootCauseTask: { select: { id: true } },
    },
  });
  // Sev-1 customer issues without a task yet (a second resolution creates no second task, AC6).
  const candidates = issues.filter((i) => i.severity === "SEV1" && i.communicatorRule !== "ISSUE_OWNER_PARTNER" && !i.rootCauseTask);
  if (candidates.length === 0) return 0;

  const entityIds = [...new Set(candidates.map((i) => i.entityId))];
  const [cards, team] = await Promise.all([
    tx.obligationCard.findMany({
      where: { entityId: { in: entityIds }, kind: "CUSTOMER_AGREEMENT" },
      select: { entityId: true, regulatoryRegime: true, postIncidentReportDays: true },
    }),
    tx.issueTeamMember.findMany({
      where: { entityId: { in: entityIds }, team: "COMPLIANCE" },
      select: { entityId: true, user: { select: { id: true, name: true, active: true } } },
    }),
  ]);
  const cardOf = new Map(cards.map((c) => [c.entityId, c]));
  const reviewerOf = new Map(team.map((m) => [m.entityId, m.user]));

  const tasks: Prisma.RootCauseReportTaskCreateManyInput[] = [];
  const contributors: Prisma.IssueContributorCreateManyInput[] = [];
  const audit: Parameters<typeof recordFieldsMany>[1] = [];
  const history: Parameters<typeof addHistoryMany>[1] = [];

  for (const issue of candidates) {
    const card = cardOf.get(issue.entityId);
    const regime = card?.regulatoryRegime ?? null;
    if (regime === null || regime === "NONE") continue; // not captured: the issue shows the muted line (AC2); None: nothing

    const reportDays = card?.postIncidentReportDays ?? null;
    const dueAt = reportDueAt(params.resolvedAt, reportDays, teamCalendar(issue.ownerTeam, issue.owner));
    const dueLocal = toLocalDate(dueAt);
    tasks.push({ issueId: issue.id, createdAt: params.resolvedAt, reportDays, dueAt, dueDate: new Date(dueLocal) });

    const actionId = randomUUID();
    const objectLabel = `Issue: ${issueDisplayId(issue.number)}`;
    const common = { actionId, entityId: issue.entityId, objectType: "ISSUE" as const, objectId: issue.id, objectLabel, actor: params.actor, createdAt: params.resolvedAt };
    audit.push({
      ...common,
      fields: createFields({
        "Root cause report task": "Created",
        "Root cause report due": formatDate(dueLocal),
        "Post-incident report due (days)": reportDays !== null ? `${reportDays} days` : `${REPORT_DEFAULT_BUSINESS_DAYS} business days (the contract names none)`,
      }),
    });

    // The entity's named Compliance person joins as contributor unless already on the issue (AC4).
    const reviewer = reviewerOf.get(issue.entityId);
    if (reviewer && reviewer.active && reviewer.id !== issue.ownerId && !issue.contributors.some((c) => c.userId === reviewer.id)) {
      contributors.push({ issueId: issue.id, userId: reviewer.id, addedAt: params.resolvedAt, addedForReport: true });
      audit.push({ ...common, fields: createFields({ Contributor: reviewer.name }) });
    }

    history.push({
      entityId: issue.entityId,
      category: "INCIDENT",
      summary: `Root cause report task created, due ${formatDate(dueLocal)}`,
      actionId,
      createdAt: params.resolvedAt,
      issueId: issue.id,
      actorId: params.actor.userId,
      actorName: params.actor.userName,
      actorTeam: params.actor.userTeam,
    });
  }

  if (tasks.length === 0) return 0;
  await tx.rootCauseReportTask.createMany({ data: tasks });
  if (contributors.length > 0) await tx.issueContributor.createMany({ data: contributors });
  await recordFieldsMany(tx, audit);
  await addHistoryMany(tx, history);
  return tasks.length;
}

/** M27 AC5. Owner only (403 for anyone else); the task must exist and not be recorded yet. */
export async function recordReportSent(user: SessionUser, issueId: string, input: RecordReportSentInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log, t) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId }, include: { entity: { select: { legalName: true } }, rootCauseTask: true } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    // Permission before business rule: a non-owner gets 403 whatever the task's state.
    await assertIsOwner(tx, issue, user);
    const task = issue.rootCauseTask;
    if (!task) throw new ValidationError({ task: ["This issue has no root cause report task"] });
    if (task.sentAt) throw new ValidationError({ task: ["The root cause report is already recorded"] });
    // The owner shares a draft and Compliance approves it first: the report cannot be recorded as sent before that.
    if (!task.draftSharedAt) throw new ValidationError({ task: ["Share the draft of the report first"] });
    if (!task.approvedAt) throw new ValidationError({ task: ["Compliance must approve the report before it is sent"] });

    const requester = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    const sentAt = new Date(input.sentAt);
    if (Number.isNaN(sentAt.getTime())) throw new ValidationError({ sentAt: ["Enter the date and time the report was sent"] });
    if (sentAt > now()) throw new ValidationError({ sentAt: ["The time can't be in the future"] });
    // The form takes minutes: "now" read to the minute, right after a resolution within that same minute, is not "before" it.
    if (issue.resolvedAt && sentAt < new Date(Math.floor(issue.resolvedAt.getTime() / 60_000) * 60_000)) {
      throw new ValidationError({ sentAt: [`The time can't be before Resolved at (${formatInZone(issue.resolvedAt, zone)})`] });
    }

    const contact = await tx.contact.findFirst({ where: { id: input.contactId, entityId: issue.entityId, status: "ACTIVE", context: "CUSTOMER" }, select: { id: true, fullName: true } });
    if (!contact) throw new ValidationError({ contactId: ["Select an active customer contact"] });

    await tx.rootCauseReportTask.update({
      where: { id: task.id },
      data: {
        sentAt,
        sentToContactId: contact.id,
        sentToName: contact.fullName,
        channel: input.channel,
        reportUrl: input.reportUrl || null,
        summary: input.summary,
        sentById: user.id,
      },
    });
    await tx.issueCommunication.create({
      data: {
        issueId: issue.id,
        type: "ROOT_CAUSE_REPORT_SENT",
        occurredAt: sentAt,
        channel: input.channel,
        contactId: contact.id,
        personName: contact.fullName,
        message: input.reportUrl ? `${input.summary}\n${input.reportUrl}` : input.summary,
        recordedById: user.id,
        recordedByName: user.name,
        createdAt: t,
      },
    });
    const updated = await tx.issue.update({ where: { id: issue.id }, data: { version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({
        "Root cause report sent": formatInZone(sentAt, zone),
        "Report sent to": contact.fullName,
        "Report channel": COMMUNICATION_CHANNEL_LABELS[input.channel],
        "Report link": input.reportUrl || null,
        "Report summary": input.summary,
        "Report sent by": user.name,
      }),
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Root cause report sent to ${contact.fullName} (${issue.entity.legalName}). By ${user.name}, ${TEAM_LABELS[user.team]}.`,
    });
    // The report is often the last open step: the issue then closes.
    return (await closeWhenAllStepsDone(tx, log, issue.id, user.id, t)) ?? updated;
  });
}

/**
 * The owner shares a draft of the root cause report (the first step of the three: prepare, approve, send). Owner only. A new draft replaces the
 * one Compliance asked changes on; the previous one stays in History (its event carries the link and summary). Nothing is sent by the app.
 */
export async function shareDraft(user: SessionUser, issueId: string, input: ShareDraftInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log, t) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId }, include: { entity: { select: { legalName: true } }, rootCauseTask: true } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    // Permission before business rule: a non-owner gets 403 whatever the task's state.
    await assertIsOwner(tx, issue, user);
    const task = issue.rootCauseTask;
    if (!task) throw new ValidationError({ task: ["This issue has no root cause report task"] });
    if (task.sentAt) throw new ValidationError({ task: ["The root cause report is already recorded"] });
    if (task.approvedAt) throw new ValidationError({ task: ["The root cause report is already approved"] });
    if (task.draftSharedAt) throw new ValidationError({ task: ["The draft is shared and waits for Compliance"] });

    const requester = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    await tx.rootCauseReportTask.update({
      where: { id: task.id },
      data: {
        draftLink: input.draftLink,
        draftSummary: input.draftSummary,
        draftSharedAt: t,
        draftSharedById: user.id,
        changesRequestedAt: null,
        changesRequestedById: null,
        changesRequestReason: null,
      },
    });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ "Root cause report draft shared": formatInZone(t, zone), "Draft shared by": user.name, "Draft link": input.draftLink, "Draft summary": input.draftSummary }),
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Root cause report draft shared by ${user.name} (${TEAM_LABELS[user.team]})`,
      details: { kind: "REPORT_DRAFT_SHARED", draftLink: input.draftLink, draftSummary: input.draftSummary },
    });
    return issue;
  });
}

/**
 * Compliance asks for changes on the shared draft. Any Compliance-team user (403 for everyone else). The draft is cleared and Prepare reopens
 * for the owner; the draft that was refused stays in History (the "Draft shared" event, and this event, carry its link and summary).
 */
export async function requestChanges(user: SessionUser, issueId: string, input: RequestChangesInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.compliance");

  return mutate(user, { entityId }, async (tx, log, t) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId }, include: { rootCauseTask: true } });
    if (!issue) throw new NotFoundError();
    const task = issue.rootCauseTask;
    if (!task) throw new ValidationError({ task: ["This issue has no root cause report task"] });
    if (task.sentAt) throw new ValidationError({ task: ["The root cause report is already recorded"] });
    if (task.approvedAt) throw new ValidationError({ task: ["The root cause report is already approved"] });
    if (!task.draftSharedAt) throw new ValidationError({ task: ["The owner has not shared the draft yet"] });

    await tx.rootCauseReportTask.update({
      where: { id: task.id },
      data: { draftLink: null, draftSummary: null, draftSharedAt: null, draftSharedById: null, changesRequestedAt: t, changesRequestedById: user.id, changesRequestReason: input.reason },
    });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ "Changes requested by": user.name, "Changes requested": input.reason }),
      reason: input.reason,
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Changes requested by ${user.name} (${TEAM_LABELS[user.team]}): ${input.reason}`,
      details: { kind: "REPORT_CHANGES_REQUESTED", reason: input.reason, draftLink: task.draftLink, draftSummary: task.draftSummary },
    });
    return issue;
  });
}

/**
 * Compliance approves the root cause report before the owner sends it. Any Compliance-team user can, the same permission as an
 * assessment (`issue.compliance`: 403 for everyone else). The Done line, the History event and the audit entry name the person who
 * actually approved, never the one the step is assigned to. Does not touch the issue's version: the owner's page stays valid.
 */
export async function approveReport(user: SessionUser, issueId: string, input: ApproveReportInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.compliance");

  return mutate(user, { entityId }, async (tx, log, t) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId }, include: { entity: { select: { legalName: true } }, rootCauseTask: true } });
    if (!issue) throw new NotFoundError();
    const task = issue.rootCauseTask;
    if (!task) throw new ValidationError({ task: ["This issue has no root cause report task"] });
    if (task.approvedAt) throw new ValidationError({ task: ["The root cause report is already approved"] });
    if (task.sentAt) throw new ValidationError({ task: ["The root cause report is already recorded"] });
    if (!task.draftSharedAt) throw new ValidationError({ task: ["The owner has not shared the draft yet"] });

    const requester = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    const note = input.note?.trim() || null;
    await tx.rootCauseReportTask.update({ where: { id: task.id }, data: { approvedAt: t, approvedById: user.id, approvalNote: note } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ "Root cause report approved": formatInZone(t, zone), "Report approved by": user.name, "Approval note": note }),
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Root cause report approved by ${user.name} (${TEAM_LABELS[user.team]})`,
    });
    return issue;
  });
}
