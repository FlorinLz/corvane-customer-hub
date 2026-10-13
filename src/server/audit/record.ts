import type { AuditObjectType, AuditSource, Prisma, Team } from "@prisma/client";

export interface AuditActor {
  userId: string | null;
  userName: string;
  // null for a system actor with no team, e.g. "Monitoring (automatic)", "Customer Hub (automatic)" (brief B36, M21 AC14).
  userTeam: Team | null;
}

export interface AuditFieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** One row per key whose formatted value is non-null (brief 3.1.0: a field never set is not a "change"). */
export function createFields(fields: Record<string, string | null>): AuditFieldChange[] {
  return Object.entries(fields)
    .filter(([, newValue]) => newValue !== null)
    .map(([field, newValue]) => ({ field, oldValue: null, newValue }));
}

/** One row per key whose formatted value differs between `before` and `after`. */
export function updateFields(
  before: Record<string, string | null>,
  after: Record<string, string | null>,
): AuditFieldChange[] {
  const out: AuditFieldChange[] = [];
  for (const field of Object.keys(after)) {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;
    if (oldValue !== newValue) out.push({ field, oldValue, newValue });
  }
  return out;
}

/**
 * Brief 3.1.3: one AuditEntry per changed field, same actionId. Call inside
 * the write's transaction (or the seed's db-admin client, which bypasses
 * permission checks but writes through the same helper, brief 7.1.0).
 * `createdAt` is required (not left to the schema's own @default(now()),
 * which reads the database's real clock, not the demo clock) -- every
 * caller must pass the same `now()` instant already in scope for the rest
 * of its own write.
 */
export async function recordFields(
  tx: Prisma.TransactionClient,
  params: {
    actionId: string;
    entityId?: string;
    groupId?: string;
    objectType: AuditObjectType;
    objectId: string;
    objectLabel: string;
    fields: AuditFieldChange[];
    actor: AuditActor;
    source?: AuditSource;
    reason?: string;
    createdAt: Date;
  },
): Promise<void> {
  if (params.fields.length === 0) return;
  await tx.auditEntry.createMany({
    data: params.fields.map((f) => ({
      actionId: params.actionId,
      entityId: params.entityId,
      groupId: params.groupId,
      objectType: params.objectType,
      objectId: params.objectId,
      objectLabel: params.objectLabel,
      field: f.field,
      oldValue: f.oldValue,
      newValue: f.newValue,
      reason: params.reason,
      source: params.source ?? "USER",
      userId: params.actor.userId,
      userName: params.actor.userName,
      userTeam: params.actor.userTeam,
      createdAt: params.createdAt,
    })),
  });
}

/** The rows of several `recordFields()` calls in ONE insert (different objects, entities and actions): one round trip however many objects. */
export async function recordFieldsMany(tx: Prisma.TransactionClient, calls: Parameters<typeof recordFields>[1][]): Promise<void> {
  const data = calls.flatMap((params) =>
    params.fields.map((f) => ({
      actionId: params.actionId,
      entityId: params.entityId,
      groupId: params.groupId,
      objectType: params.objectType,
      objectId: params.objectId,
      objectLabel: params.objectLabel,
      field: f.field,
      oldValue: f.oldValue,
      newValue: f.newValue,
      reason: params.reason,
      source: params.source ?? ("USER" as const),
      userId: params.actor.userId,
      userName: params.actor.userName,
      userTeam: params.actor.userTeam,
      createdAt: params.createdAt,
    })),
  );
  if (data.length === 0) return;
  await tx.auditEntry.createMany({ data });
}
