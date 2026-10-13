import { createFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { formatDate, toLocalDate, today } from "@/lib/dates";
import { COVERAGE_STATUS_LABELS, SCHEME_LABELS, TEAM_LABELS } from "@/lib/labels";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { validateCoverageStatusChange } from "@/lib/rules/coverage";
import type { ChangeCoverageStatusInput } from "@/lib/validation/coverage";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { recomputeLifecycle } from "@/server/services/lifecycle-recompute";
import { db } from "@/server/db";

/** Brief 3.8.2 "Change coverage status", M5 AC7-AC9, AC12, AC14, AC15, AC17. Network. M5 R1: effective date not in the future (guard 4). */
export async function changeCoverageStatus(user: SessionUser, coverageId: string, input: ChangeCoverageStatusInput) {
  assertCan(user, "partner.coverage.changeStatus");

  const target = await db.partnerCoverage.findUnique({
    where: { id: coverageId },
    select: { partnerRole: { select: { entityId: true } } },
  });
  if (!target) throw new NotFoundError();

  return mutate(user, { entityId: target.partnerRole.entityId }, async (tx, log, now) => {
    const row = await tx.partnerCoverage.findUnique({
      where: { id: coverageId },
      include: {
        statusChanges: { select: { status: true, effectiveDate: true, createdAt: true } },
        partnerRole: { select: { entity: { select: { deletedAt: true } } } },
      },
    });
    if (!row) throw new NotFoundError();
    assertCan(user, "partner.coverage.changeStatus", { entity: { deletedAt: row.partnerRole.entity.deletedAt } });
    if (row.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "COVERAGE_ROW", coverageId, "coverage"));
    }

    const current = computeCoverageStatus(
      row.statusChanges.map((c) => ({ status: c.status, effectiveDate: toLocalDate(c.effectiveDate), createdAt: c.createdAt })),
      today(),
    ).current;

    const coverageError = validateCoverageStatusChange({
      currentStatus: current?.status ?? null,
      currentEffectiveDate: current?.effectiveDate ?? null,
      newStatus: input.status,
      newEffectiveDate: input.effectiveDate,
      today: today(),
    });
    if (coverageError) throw new ValidationError({ [coverageError.field]: [coverageError.message] });

    await tx.coverageStatusChange.create({
      data: { coverageId, status: input.status, effectiveDate: new Date(input.effectiveDate), reason: input.reason, userId: user.id, createdAt: now },
    });
    await tx.partnerCoverage.update({ where: { id: coverageId }, data: { version: { increment: 1 } } });

    const label = `${row.country} / ${SCHEME_LABELS[row.scheme]}`;
    await log.change({
      objectType: "COVERAGE_ROW",
      objectId: coverageId,
      objectLabel: `Coverage: ${label}`,
      fields: createFields({ Status: COVERAGE_STATUS_LABELS[input.status], "Effective date": formatDate(input.effectiveDate) }),
      reason: input.reason,
    });
    await log.history({
      category: "NETWORK_AND_STRUCTURE",
      summary: `Coverage ${label}: ${current ? COVERAGE_STATUS_LABELS[current.status] : "None"} → ${COVERAGE_STATUS_LABELS[input.status]} (effective ${formatDate(input.effectiveDate)}). Reason: ${input.reason}. By ${user.name}, ${TEAM_LABELS[user.team]}.`,
    });

    await recomputeLifecycle(tx, target.partnerRole.entityId);

    return { id: coverageId };
  });
}
