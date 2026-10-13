import { db } from "@/server/db";

// Brief 3.8.3-style on-demand context for the Ops -> CS send form (S6
// View B), M8 AC1, AC3-AC8: fetched only when the drawer opens, like the
// issue report drawer's own "issue-context" route precedent (6B).

export async function loadOpsToCsContext(entityId: string) {
  const entity = await db.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      legalName: true,
      deletedAt: true,
      customerRole: { select: { active: true } },
      products: {
        where: { cancelledAt: null },
        select: { id: true, product: true, country: true, stage: true, stageEnteredAt: true, billableFrom: true, blockedBy: true, blockedReason: true, blockedSince: true },
      },
      contacts: {
        where: { context: "CUSTOMER", status: "ACTIVE" },
        select: { id: true, role: true, fullName: true, email: true, phone: true, lastVerifiedAt: true },
      },
    },
  });
  if (!entity) return null;

  const hasEligibleProduct = entity.products.some((p) => p.stage === "RAMP_UP" || p.stage === "BAU");
  const existingOpen = await db.handoff.findFirst({ where: { entityId, type: "OPS_TO_CS", status: "SENT" } });
  const csUsers = await db.user.findMany({ where: { team: "CS", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const hasActiveIncidentContact = entity.contacts.some((c) => c.role === "INCIDENT");
  const hasActiveChampion = entity.contacts.some((c) => c.role === "CHAMPION");

  return {
    entityId: entity.id,
    entityName: entity.legalName,
    hasEligibleProduct,
    hasOpenHandoff: !!existingOpen,
    hasActiveIncidentContact,
    hasActiveChampion,
    products: entity.products.map((p) => ({
      id: p.id,
      product: p.product,
      country: p.country,
      stage: p.stage,
      stageEnteredAt: p.stageEnteredAt.toISOString().slice(0, 10),
      billableFrom: p.billableFrom?.toISOString().slice(0, 10) ?? null,
      blockedBy: p.blockedBy,
      blockedReason: p.blockedReason,
      blockedSince: p.blockedSince?.toISOString().slice(0, 10) ?? null,
    })),
    contacts: entity.contacts.map((c) => ({
      id: c.id,
      role: c.role,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      lastVerifiedAt: c.lastVerifiedAt?.toISOString().slice(0, 10) ?? null,
    })),
    csUsers,
  };
}

export type OpsToCsContext = NonNullable<Awaited<ReturnType<typeof loadOpsToCsContext>>>;
