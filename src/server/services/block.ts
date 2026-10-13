import { updateFields } from "@/server/audit/record";
import { auditEnum } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { daysBetween, today, toLocalDate } from "@/lib/dates";
import { BLOCKED_BY_LABELS, SCHEME_LABELS } from "@/lib/labels";
import type { ResolveBlockInput, SetBlockInput } from "@/lib/validation/block";
import { ConflictError, NotFoundError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { db } from "@/server/db";

async function loadProductForWrite(productId: string) {
  const target = await db.contractedProduct.findUnique({ where: { id: productId }, select: { entityId: true } });
  if (!target) throw new NotFoundError();
  return target;
}

/** Brief 3.8.2 "Set or edit block", M6 AC7, AC8. Ops. */
export async function setBlock(user: SessionUser, productId: string, input: SetBlockInput) {
  assertCan(user, "product.block.edit");
  const target = await loadProductForWrite(productId);

  return mutate(user, { entityId: target.entityId }, async (tx, log, now) => {
    const product = await tx.contractedProduct.findUnique({ where: { id: productId }, include: { entity: { select: { deletedAt: true } } } });
    if (!product) throw new NotFoundError();
    assertCan(user, "product.block.edit", { entity: { deletedAt: product.entity.deletedAt } });
    if (product.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "CONTRACTED_PRODUCT", productId, "product line"));
    }

    const wasBlocked = product.blockedBy !== null;
    const blockedSince = wasBlocked ? product.blockedSince! : new Date(today());

    await tx.contractedProduct.update({
      where: { id: productId },
      data: { blockedBy: input.blockedBy, blockedReason: input.reason, blockedSince, version: { increment: 1 } },
    });
    await tx.stageEvent.create({
      data: { productId, kind: wasBlocked ? "BLOCK_EDITED" : "BLOCK_SET", blockedBy: input.blockedBy, reason: input.reason, userId: user.id, createdAt: now },
    });

    const label = `${SCHEME_LABELS[product.product]} / ${product.country}`;
    await log.change({
      objectType: "CONTRACTED_PRODUCT",
      objectId: productId,
      objectLabel: `Product line: ${label}`,
      fields: updateFields(
        { "Blocked by": auditEnum(product.blockedBy, BLOCKED_BY_LABELS) },
        { "Blocked by": auditEnum(input.blockedBy, BLOCKED_BY_LABELS) },
      ),
      reason: input.reason,
    });
    await log.history({
      category: "STAGE_CHANGE",
      summary: `${label} marked blocked by ${BLOCKED_BY_LABELS[input.blockedBy]}: ${input.reason}`,
    });

    return { id: productId };
  });
}

/** Brief 3.8.2 "Resolve block", M6 AC8. Ops. */
export async function resolveBlock(user: SessionUser, productId: string, input: ResolveBlockInput) {
  assertCan(user, "product.block.edit");
  const target = await loadProductForWrite(productId);

  return mutate(user, { entityId: target.entityId }, async (tx, log, now) => {
    const product = await tx.contractedProduct.findUnique({ where: { id: productId }, include: { entity: { select: { deletedAt: true } } } });
    if (!product) throw new NotFoundError();
    assertCan(user, "product.block.edit", { entity: { deletedAt: product.entity.deletedAt } });
    if (!product.blockedBy) throw new ConflictError("This product line has no open block.");
    if (product.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "CONTRACTED_PRODUCT", productId, "product line"));
    }

    const blockDays = daysBetween(toLocalDate(product.blockedSince!), today());

    await tx.contractedProduct.update({
      where: { id: productId },
      data: { blockedBy: null, blockedReason: null, blockedSince: null, version: { increment: 1 } },
    });
    await tx.stageEvent.create({
      data: { productId, kind: "BLOCK_RESOLVED", blockedBy: product.blockedBy, blockDays, note: input.note, userId: user.id, createdAt: now },
    });

    const label = `${SCHEME_LABELS[product.product]} / ${product.country}`;
    await log.change({
      objectType: "CONTRACTED_PRODUCT",
      objectId: productId,
      objectLabel: `Product line: ${label}`,
      fields: updateFields({ Blocked: "Yes" }, { Blocked: "No" }),
      reason: input.note,
    });
    await log.history({
      category: "STAGE_CHANGE",
      summary: `${label} block resolved after ${blockDays} day${blockDays === 1 ? "" : "s"}`,
    });

    return { id: productId };
  });
}
