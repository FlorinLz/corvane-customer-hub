import { updateFields } from "@/server/audit/record";
import { auditDate } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { db } from "@/server/db";
import { daysBetween, formatDate, toLocalDate, today } from "@/lib/dates";
import { SCHEME_LABELS, STAGE_LABELS, TEAM_LABELS } from "@/lib/labels";
import { entersLiveHypercareFirstTime, validateStageChange } from "@/lib/rules/stage-engine";
import type { ChangeStageInput } from "@/lib/validation/stage";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { recomputeLifecycle } from "@/server/services/lifecycle-recompute";

/**
 * Brief 3.8.2 "Change stage", M6 AC4-AC6, AC9, AC11, AC12. Ops. M5 R1 is
 * forward N+1 only; "Billable from" is set automatically on entry to
 * Live & hypercare (no separate UI — a side effect of this write).
 */
export async function changeStage(user: SessionUser, productId: string, input: ChangeStageInput) {
  assertCan(user, "product.stage.change");

  const target = await db.contractedProduct.findUnique({ where: { id: productId }, select: { entityId: true } });
  if (!target) throw new NotFoundError();

  return mutate(user, { entityId: target.entityId }, async (tx, log, now) => {
    const product = await tx.contractedProduct.findUnique({
      where: { id: productId },
      include: { entity: { select: { id: true, deletedAt: true } } },
    });
    if (!product) throw new NotFoundError();
    assertCan(user, "product.stage.change", { entity: { deletedAt: product.entity.deletedAt } });
    if (product.cancelledAt) throw new ConflictError("This product line was cancelled.");
    if (product.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "CONTRACTED_PRODUCT", productId, "product line"));
    }

    const stageEnteredAt = toLocalDate(product.stageEnteredAt);
    const stageError = validateStageChange({
      fromStage: product.stage,
      toStage: input.toStage,
      entryDate: input.entryDate,
      stageEnteredAt,
      today: today(),
    });
    if (stageError) throw new ValidationError({ [stageError.field]: [stageError.message] });

    const existingBillableFrom = product.billableFrom ? toLocalDate(product.billableFrom) : null;
    const resolvingBlock = Boolean(input.resolveBlock && product.blockedBy);
    const enteringLiveHypercare = entersLiveHypercareFirstTime(input.toStage, existingBillableFrom);
    const billableFrom = enteringLiveHypercare ? input.entryDate : existingBillableFrom;

    await tx.contractedProduct.update({
      where: { id: productId },
      data: {
        stage: input.toStage,
        stageEnteredAt: new Date(input.entryDate),
        billableFrom: enteringLiveHypercare ? new Date(input.entryDate) : undefined,
        version: { increment: 1 },
        ...(resolvingBlock ? { blockedBy: null, blockedReason: null, blockedSince: null } : {}),
      },
    });

    await tx.stageEvent.create({
      data: {
        productId,
        kind: "STAGE_FORWARD",
        fromStage: product.stage,
        toStage: input.toStage,
        entryDate: new Date(input.entryDate),
        note: input.note,
        userId: user.id,
        createdAt: now,
      },
    });

    const blockDays = product.blockedSince ? daysBetween(toLocalDate(product.blockedSince), today()) : 0;
    if (resolvingBlock) {
      await tx.stageEvent.create({
        data: { productId, kind: "BLOCK_RESOLVED", blockedBy: product.blockedBy, blockDays, note: input.note, userId: user.id, createdAt: now },
      });
    }

    const label = `${SCHEME_LABELS[product.product]} / ${product.country}`;
    await log.change({
      objectType: "CONTRACTED_PRODUCT",
      objectId: productId,
      objectLabel: `Product line: ${label}`,
      fields: [
        ...updateFields({ Stage: STAGE_LABELS[product.stage] }, { Stage: STAGE_LABELS[input.toStage] }),
        ...updateFields({ "Stage entered": auditDate(stageEnteredAt) }, { "Stage entered": auditDate(input.entryDate) }),
        ...(enteringLiveHypercare ? updateFields({ "Billable from": null }, { "Billable from": auditDate(billableFrom) }) : []),
        ...(resolvingBlock ? updateFields({ Blocked: "Yes" }, { Blocked: "No" }) : []),
      ],
      reason: input.reason,
    });

    await log.history({
      category: "STAGE_CHANGE",
      summary: `${label}: ${STAGE_LABELS[product.stage]} → ${STAGE_LABELS[input.toStage]} (entered ${formatDate(input.entryDate)}). By ${user.name}, ${TEAM_LABELS[user.team]}`,
    });
    if (resolvingBlock) {
      await log.history({ category: "STAGE_CHANGE", summary: `${label} block resolved after ${blockDays} day${blockDays === 1 ? "" : "s"}` });
    }

    await recomputeLifecycle(tx, product.entityId);

    return { id: productId };
  });
}
