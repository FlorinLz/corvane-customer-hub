import { randomUUID } from "node:crypto";

import {
  ActionItemStatus,
  ContactContext,
  ContactRole,
  CoverageStatus,
  CustomerReporterKind,
  GroupDecision,
  HandoffStatus,
  HandoffType,
  type IssueImpact,
  type IssueType,
  NoteType,
  ObligationCardKind,
  type PrismaClient,
  Scheme,
  Stage,
  Team,
} from "@prisma/client";

import { d, ts, tsz, wtsz } from "./dates";
import { buildStageTimeline } from "./helpers";
import { NORA_LEE_TEAM_CHANGE, USERS } from "./data/users";
import { GROUPS } from "./data/groups";
import { ENTITIES, PARTNER_ONLY_NO_SALES_CREATOR } from "./data/entities";
import { CUSTOMER_CONTRACTS, CUSTOMER_ROLE_CARDS, PARTNER_AGREEMENTS } from "./data/contracts";
import { PRODUCTS } from "./data/products";
import { PARTNER_ROLES, PARTNER_ROLE_CREATED_OFFSET } from "./data/coverage";
import { CONTACTS, contactEmail } from "./data/contacts";
import { HANDOFFS, OWNER_ASSIGNMENTS } from "./data/handoffs";
import { KYB } from "./data/compliance";
import { OBLIGATIONS } from "./data/obligations";
import { BILLING_BILLED_THROUGH, BILLING_PROFILES } from "./data/billing";
import { NOTES } from "./data/notes";
import { ISSUE_TEAM } from "./data/issue-team";
import { ON_CALL } from "./data/on-call";
import { ISSUES, type SeedIssue, type SeedIssueTime } from "./data/issues";

import { type AuditActor, createFields, recordFields, updateFields } from "@/server/audit/record";
import { addHistory } from "@/server/audit/history";
import { ackStartFor } from "@/server/issues/times";
import { chooseComplianceAssessor } from "@/server/issues/compliance-assessor";
import { auditArray, auditBoolean, auditDate, auditEnum, auditText } from "@/server/audit/format";
import { lookupLei, type GleifLookup } from "@/server/gleif/client";
import { mapGleifToEntityFields } from "@/server/gleif/map";
import { getCachedRecord, getCacheCapturedAt } from "@/server/gleif/cache";
import { computeLifecycle } from "@/server/derived/lifecycle";
import { normaliseCore, normaliseSearch } from "@/lib/validation/normalise";
import { formatDate } from "@/lib/dates";
import { addBusinessMinutes, teamCalendar, userCalendar } from "@/lib/business-hours";
import {
  CONTACT_ROLE_LABELS,
  ISSUE_TYPE_LABELS,
  LIFECYCLE_LABELS,
  REGULATORY_REGIME_LABELS,
  SCHEME_LABELS,
  SEVERITY_LABELS,
  STAGE_LABELS,
  TEAM_LABELS,
  issueDisplayId,
} from "@/lib/labels";
import { ACK_TARGET, ISSUE_TYPE_ROUTING, NOTIFY_TARGET_SEV1_DEFAULT_HOURS, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES } from "@/server/config";
import { proposeSeverity } from "@/server/derived/severity";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { routeIssue } from "@/server/issues/routing";
import { complianceReasons } from "@/server/issues/compliance";

function dateOnly(offset: number): Date {
  return new Date(`${d(offset)}T00:00:00.000Z`);
}

function actionId(): string {
  return randomUUID();
}

/** Brief 7.1.0: GLEIF_SEED_SOURCE picks cache-only (tests) or live-with-cache-fallback (demo). */
async function seedGleifLookup(lei: string): Promise<GleifLookup> {
  if (process.env.GLEIF_SEED_SOURCE === "cache") {
    const record = getCachedRecord(lei);
    if (!record) return { kind: "unavailable" };
    return { kind: "found", source: "CACHE", fetchedAt: getCacheCapturedAt(), record, parentsUnavailable: false };
  }
  return lookupLei(lei);
}

function ownerTeamsFor(context: "CUSTOMER" | "PARTNER", role: ContactRole): Team[] {
  if (role === ContactRole.BILLING) return [Team.FINANCE];
  if (context === "PARTNER") return [Team.NETWORK];
  if (role === ContactRole.CHAMPION || role === ContactRole.DECISION_MAKER) return [Team.SALES, Team.CS];
  return [Team.OPS];
}

export async function seed(db: PrismaClient): Promise<void> {
  const userIdByKey: Record<string, string> = {};
  const userByKey = new Map(USERS.map((u) => [u.key, u]));

  function actor(userKey: string): { userId: string; userName: string; userTeam: Team } {
    const u = userByKey.get(userKey);
    if (!u) throw new Error(`Unknown user key: ${userKey}`);
    return { userId: userIdByKey[userKey], userName: u.name, userTeam: u.team as Team };
  }

  /** "Monitoring (automatic)" (brief 1484, 2003): no user, no team, source SYSTEM_ISSUE. */
  const monitoringActor: AuditActor = { userId: null, userName: "Monitoring (automatic)", userTeam: null };

  // ───────────────────────── Phase 1: Users ─────────────────────────
  for (const u of USERS) {
    const row = await db.user.create({
      data: {
        name: u.name,
        email: u.email,
        team: u.key === NORA_LEE_TEAM_CHANGE.key ? (NORA_LEE_TEAM_CHANGE.createdTeam as Team) : (u.team as Team),
        isAdmin: u.isAdmin,
        timeZone: u.timeZone,
        createdAt: ts(-400),
      },
    });
    userIdByKey[u.key] = row.id;
  }
  // Nora Lee: created CS, then moved to Network (scenario decision 6). Apply the
  // current team now that Adrian (the audit actor) exists.
  await db.user.update({ where: { id: userIdByKey.nora }, data: { team: Team.NETWORK } });

  const adrianActor = actor("adrian");
  for (const u of USERS) {
    await recordFields(db as never, {
      actionId: actionId(),
      objectType: "USER",
      objectId: userIdByKey[u.key],
      objectLabel: `User: ${u.name}`,
      fields: createFields({ Team: TEAM_LABELS[u.key === NORA_LEE_TEAM_CHANGE.key ? (NORA_LEE_TEAM_CHANGE.createdTeam as Team) : (u.team as Team)] }),
      actor: adrianActor,
      createdAt: ts(-400),
    });
    await db.userTeamChange.create({
      data: {
        userId: userIdByKey[u.key],
        kind: "USER_ADDED",
        oldTeam: null,
        newTeam: u.key === NORA_LEE_TEAM_CHANGE.key ? (NORA_LEE_TEAM_CHANGE.createdTeam as Team) : (u.team as Team),
        changedById: userIdByKey.adrian,
        changedAt: ts(-400),
      },
    });
  }
  {
    const [offset, time] = NORA_LEE_TEAM_CHANGE.changedAt;
    const changedAt = ts(offset, time);
    await recordFields(db as never, {
      actionId: actionId(),
      objectType: "USER",
      objectId: userIdByKey.nora,
      objectLabel: "User: Nora Lee",
      fields: updateFields({ Team: TEAM_LABELS.CS }, { Team: TEAM_LABELS.NETWORK }),
      actor: adrianActor,
      createdAt: changedAt,
    });
    await db.userTeamChange.create({
      data: {
        userId: userIdByKey.nora,
        kind: "TEAM_CHANGED",
        oldTeam: "CS",
        newTeam: "NETWORK",
        changedById: userIdByKey.adrian,
        changedAt,
      },
    });
  }

  // ───────────────────────── Phase 2: Groups ─────────────────────────
  const groupIdByKey: Record<string, string> = {};
  for (const g of GROUPS) {
    const row = await db.group.create({
      data: {
        name: g.name,
        nameNormalized: normaliseSearch(g.name),
        parentLei: g.parentLei,
        parentLegalName: g.parentLegalName,
        parentLeiStatus: "ISSUED",
        parentGleifCheckedAt: ts(g.createdOffset),
        hqCountry: g.hqCountry,
        createdAt: ts(g.createdOffset),
      },
    });
    groupIdByKey[g.key] = row.id;
    await recordFields(db as never, {
      actionId: actionId(),
      groupId: row.id,
      objectType: "GROUP",
      objectId: row.id,
      objectLabel: `Group: ${g.name}`,
      fields: createFields({
        Name: g.name,
        "Parent LEI": g.parentLei,
        "Parent legal name": g.parentLegalName,
        "HQ country": g.hqCountry,
      }),
      actor: actor(g.createdBy),
      createdAt: ts(g.createdOffset),
    });
  }

  // ───────────────────────── Phase 3: Entities ─────────────────────────
  const entityIdByKey: Record<string, string> = {};
  const entityByKey = new Map(ENTITIES.map((e) => [e.key, e]));

  for (const e of ENTITIES) {
    const checkedAt = ts(e.createdOffset);
    const lookup = await seedGleifLookup(e.lei);
    const gleif = mapGleifToEntityFields(lookup, checkedAt);

    const row = await db.entity.create({
      data: {
        legalName: e.legalName,
        legalNameSearch: normaliseSearch(e.legalName),
        legalNameCore: normaliseCore(e.legalName),
        type: e.type,
        country: e.country,
        lei: e.lei,
        leiStatus: gleif.leiStatus,
        gleifRawStatus: gleif.gleifRawStatus,
        leiNextRenewalDate: gleif.leiNextRenewalDate ? new Date(`${gleif.leiNextRenewalDate}T00:00:00.000Z`) : null,
        gleifCheckedAt: gleif.gleifCheckedAt,
        gleifSource: gleif.gleifSource,
        gleifLegalName: gleif.gleifLegalName,
        gleifCountry: gleif.gleifCountry,
        gleifDirectParentLei: gleif.gleifDirectParentLei,
        gleifDirectParentName: gleif.gleifDirectParentName,
        gleifUltimateParentLei: gleif.gleifUltimateParentLei,
        gleifUltimateParentName: gleif.gleifUltimateParentName,
        gleifSuccessorLei: gleif.gleifSuccessorLei,
        groupId: e.group ? groupIdByKey[e.group] : null,
        groupDecision: e.group ? GroupDecision.GROUP : GroupDecision.STANDALONE,
        ownerId: e.ownerKey ? userIdByKey[e.ownerKey] : null,
        ownerSince: e.ownerSinceOffset !== null ? ts(e.ownerSinceOffset) : null,
        createdById: PARTNER_ONLY_NO_SALES_CREATOR.has(e.key) ? userIdByKey.adrian : userIdByKey[e.createdBy],
        createdAt: ts(e.createdOffset),
      },
    });
    entityIdByKey[e.key] = row.id;

    for (const alias of e.aliases) {
      await db.entityAlias.create({
        data: { entityId: row.id, alias, aliasSearch: normaliseSearch(alias), aliasCore: normaliseCore(alias) },
      });
    }
    for (const bic of e.bics) {
      await db.entityBic.create({ data: { entityId: row.id, bic, bic8: bic.slice(0, 8) } });
    }

    const creatorKey = PARTNER_ONLY_NO_SALES_CREATOR.has(e.key) ? "adrian" : e.createdBy;
    const creator = actor(creatorKey);
    await recordFields(db as never, {
      actionId: actionId(),
      entityId: row.id,
      objectType: "LEGAL_ENTITY",
      objectId: row.id,
      objectLabel: `Legal entity: ${e.legalName}`,
      fields: createFields({
        "Legal name": e.legalName,
        Type: e.type,
        Country: e.country,
        LEI: e.lei,
        Aliases: auditArray(e.aliases),
        BICs: auditArray(e.bics),
      }),
      actor: creator,
      createdAt: ts(e.createdOffset),
    });
    await addHistory(db as never, {
      entityId: row.id,
      category: "NETWORK_AND_STRUCTURE",
      summary: `Record created by ${creator.userName} (${TEAM_LABELS[creator.userTeam]})`,
      actionId: actionId(),
      actorId: creator.userId,
      actorName: creator.userName,
      actorTeam: creator.userTeam,
      createdAt: ts(e.createdOffset),
    });
  }

  // ───────────────────────── Phase 4: Roles (Customer / Partner) ─────────────────────────
  const customerRoleIdByEntity: Record<string, string> = {};
  const partnerRoleIdByEntity: Record<string, string> = {};

  for (const e of ENTITIES) {
    const entityId = entityIdByKey[e.key];
    if (e.roles.includes("C")) {
      const card = CUSTOMER_ROLE_CARDS.find((c) => c.entity === e.key);
      const row = await db.customerRole.create({
        data: {
          entityId,
          createdById: PARTNER_ONLY_NO_SALES_CREATOR.has(e.key) ? null : userIdByKey[e.createdBy],
          renewalDate: card?.renewalOffset != null ? dateOnly(card.renewalOffset) : null,
          slaAvailabilityPct: card?.slaAvailabilityPct ?? null,
          slaMaxResponseMs: card?.slaMaxResponseMs ?? null,
          slaOther: card?.slaOther ?? null,
          specialTerms: card?.specialTerms ?? null,
          notesForOnboarding: card?.notesForOnboarding ?? null,
          currency: card?.currency ?? null,
          pricePerVerification: card?.pricePerVerification ?? null,
          monthlyMinimum: card?.monthlyMinimum ?? null,
          paymentTermDays: card?.paymentTermDays ?? null,
          createdAt: ts(e.createdOffset),
        },
      });
      customerRoleIdByEntity[e.key] = row.id;
      if (card && card.tiers.length > 0) {
        for (let i = 0; i < card.tiers.length; i++) {
          const t = card.tiers[i];
          await db.volumeTier.create({
            data: { customerRoleId: row.id, position: i, fromVolume: t.fromVolume, toVolume: t.toVolume, pricePerVerification: t.pricePerVerification },
          });
        }
      }
    }
    if (e.roles.includes("P")) {
      const partner = PARTNER_ROLES.find((p) => p.entity === e.key);
      const roleCreatedOffset = PARTNER_ROLE_CREATED_OFFSET[e.key] ?? e.createdOffset;
      const row = await db.partnerRole.create({
        data: {
          entityId,
          connectionMethod: partner?.connectionMethod ?? null,
          providerName: partner?.providerName ?? null,
          createdAt: ts(roleCreatedOffset),
        },
      });
      partnerRoleIdByEntity[e.key] = row.id;

      // "Role added: Network partner" when the partner role was added after creation.
      if (roleCreatedOffset !== e.createdOffset) {
        await recordFields(db as never, {
          actionId: actionId(),
          entityId,
          objectType: "PARTNER_ROLE",
          objectId: row.id,
          objectLabel: `Legal entity: ${e.legalName}`,
          fields: createFields({ Role: "Network partner" }),
          actor: adrianActor,
          createdAt: ts(roleCreatedOffset),
        });
        await addHistory(db as never, {
          entityId,
          category: "NETWORK_AND_STRUCTURE",
          summary: "Role added: Network partner",
          actionId: actionId(),
          actorId: adrianActor.userId,
          actorName: adrianActor.userName,
          actorTeam: adrianActor.userTeam,
          createdAt: ts(roleCreatedOffset),
        });
      }
    }
  }

  // ───────────────────────── Phase 5: Contracts and partner agreements ─────────────────────────
  for (const c of CUSTOMER_CONTRACTS) {
    const holderEntityId = entityIdByKey[c.invoicedEntity];
    const row = await db.contract.create({
      data: {
        contractId: c.contractId,
        kind: "CUSTOMER_CONTRACT",
        title: c.title,
        signingDate: dateOnly(c.signingOffset),
        scope: c.scope,
        documentUrl: `https://docs.corvane-internal.example/${c.path}`,
        groupId: c.groupKey ? groupIdByKey[c.groupKey] : null,
        holderEntityId,
        invoicedEntityId: entityIdByKey[c.invoicedEntity],
        createdAt: ts(c.signingOffset),
      },
    });
    for (const entityKey of c.appliesTo) {
      await db.customerRole.update({ where: { id: customerRoleIdByEntity[entityKey] }, data: { contractId: row.id } });
      await recordFields(db as never, {
        actionId: actionId(),
        entityId: entityIdByKey[entityKey],
        objectType: "CUSTOMER_ROLE",
        objectId: customerRoleIdByEntity[entityKey],
        objectLabel: `Legal entity: ${entityByKey.get(entityKey)!.legalName}`,
        fields: createFields({ "Contract reference": c.contractId }),
        actor: adrianActor,
        createdAt: ts(c.signingOffset),
      });
      await addHistory(db as never, {
        entityId: entityIdByKey[entityKey],
        category: "NETWORK_AND_STRUCTURE",
        summary: `Contract attached: ${c.contractId}`,
        actionId: actionId(),
        actorId: adrianActor.userId,
        actorName: adrianActor.userName,
        actorTeam: adrianActor.userTeam,
        createdAt: ts(c.signingOffset),
      });
    }
  }

  for (const pa of PARTNER_AGREEMENTS) {
    const entityId = entityIdByKey[pa.entity];
    const row = await db.contract.create({
      data: {
        contractId: pa.contractId,
        kind: "PARTNER_AGREEMENT",
        title: pa.title,
        signingDate: dateOnly(pa.signingOffset),
        scope: "ENTITY_CONTRACT",
        documentUrl: `https://docs.corvane-internal.example/${pa.path}`,
        holderEntityId: entityId,
        invoicedEntityId: null,
        createdAt: ts(pa.signingOffset),
      },
    });
    await db.partnerRole.update({ where: { id: partnerRoleIdByEntity[pa.entity] }, data: { partnerAgreementId: row.id } });
    await recordFields(db as never, {
      actionId: actionId(),
      entityId,
      objectType: "PARTNER_ROLE",
      objectId: partnerRoleIdByEntity[pa.entity],
      objectLabel: `Legal entity: ${entityByKey.get(pa.entity)!.legalName}`,
      fields: createFields({ "Partner agreement reference": pa.contractId }),
      actor: adrianActor,
      createdAt: ts(pa.signingOffset),
    });
    await addHistory(db as never, {
      entityId,
      category: "NETWORK_AND_STRUCTURE",
      summary: `Partner agreement attached: ${pa.contractId}`,
      actionId: actionId(),
      actorId: adrianActor.userId,
      actorName: adrianActor.userName,
      actorTeam: adrianActor.userTeam,
      createdAt: ts(pa.signingOffset),
    });
  }

  // ───────────────────────── Phase 6: Product lines and stage history ─────────────────────────
  const productIdByKey: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const entityId = entityIdByKey[p.entity];
    const timeline = buildStageTimeline({
      addedOffset: p.addedOffset,
      billableFromOffset: p.billableFromOffset,
      currentStage: p.stage as Stage,
      stageEnteredOffset: p.stageEnteredOffset,
    });
    const addedBy = p.addedByAdrian ? "adrian" : entityByKey.get(p.entity)!.createdBy;

    const row = await db.contractedProduct.create({
      data: {
        entityId,
        contractingEntityId: entityId,
        product: p.product as Scheme,
        country: p.country,
        stage: p.stage as Stage,
        stageEnteredAt: dateOnly(p.stageEnteredOffset),
        targetGoLive: dateOnly(p.targetGoLiveOffset),
        billableFrom: p.billableFromOffset !== null ? dateOnly(p.billableFromOffset) : null,
        blockedBy: p.block && !p.block.resolvedOffset ? p.block.blockedBy : null,
        blockedReason: p.block && !p.block.resolvedOffset ? p.block.reason : null,
        blockedSince: p.block && !p.block.resolvedOffset ? dateOnly(p.block.setOffset) : null,
        createdAt: ts(p.addedOffset),
      },
    });
    productIdByKey[p.key] = row.id;

    const label = `${SCHEME_LABELS[p.product as Scheme]} / ${p.country}`;
    await recordFields(db as never, {
      actionId: actionId(),
      entityId,
      objectType: "CONTRACTED_PRODUCT",
      objectId: row.id,
      objectLabel: `Contracted product: ${label}`,
      fields: createFields({ Product: SCHEME_LABELS[p.product as Scheme], Country: p.country, "Target go-live": auditDate(d(p.targetGoLiveOffset)) }),
      actor: actor(addedBy),
      createdAt: ts(p.addedOffset),
    });
    await addHistory(db as never, {
      entityId,
      category: "STAGE_CHANGE",
      summary: `Product line added: ${label}, target go-live ${formatDate(d(p.targetGoLiveOffset))}`,
      actionId: actionId(),
      actorId: userIdByKey[addedBy],
      actorName: actor(addedBy).userName,
      actorTeam: actor(addedBy).userTeam,
      createdAt: ts(p.addedOffset),
    });

    for (let i = 0; i < timeline.length; i++) {
      const step = timeline[i];
      const stepActor = i === 0 ? actor(addedBy) : adrianActor;
      if (i === 0) {
        await db.stageEvent.create({
          data: { productId: row.id, kind: "PRODUCT_ADDED", toStage: step.stage, entryDate: dateOnly(step.offset), userId: stepActor.userId!, createdAt: ts(step.offset) },
        });
        continue;
      }
      const prev = timeline[i - 1];
      await db.stageEvent.create({
        data: { productId: row.id, kind: "STAGE_FORWARD", fromStage: prev.stage, toStage: step.stage, entryDate: dateOnly(step.offset), userId: stepActor.userId!, createdAt: ts(step.offset) },
      });
      await addHistory(db as never, {
        entityId,
        category: "STAGE_CHANGE",
        summary: `${label}: ${STAGE_LABELS[prev.stage]} → ${STAGE_LABELS[step.stage]} (entered ${formatDate(d(step.offset))}). By ${stepActor.userName}, ${TEAM_LABELS[stepActor.userTeam]}`,
        actionId: actionId(),
        actorId: stepActor.userId,
        actorName: stepActor.userName,
        actorTeam: stepActor.userTeam,
        createdAt: ts(step.offset),
      });
    }

    if (p.block) {
      await db.stageEvent.create({
        data: {
          productId: row.id, kind: "BLOCK_SET", blockedBy: p.block.blockedBy, reason: p.block.reason,
          userId: userIdByKey.adrian, createdAt: ts(p.block.setOffset),
        },
      });
      await addHistory(db as never, {
        entityId, category: "STAGE_CHANGE",
        summary: `${label} marked blocked by ${p.block.blockedBy === "CUSTOMER" ? "Customer" : p.block.blockedBy === "INTERNAL" ? "Corvane" : "Partner"}: ${p.block.reason}`,
        actionId: actionId(), actorId: userIdByKey.adrian, actorName: "Adrian Koh", actorTeam: "OPS", createdAt: ts(p.block.setOffset),
      });
      if (p.block.resolvedOffset !== undefined) {
        const blockDays = p.block.resolvedOffset - p.block.setOffset;
        await db.stageEvent.create({
          data: {
            productId: row.id, kind: "BLOCK_RESOLVED", blockedBy: p.block.blockedBy, blockDays,
            userId: userIdByKey.adrian, createdAt: ts(p.block.resolvedOffset),
          },
        });
        await addHistory(db as never, {
          entityId, category: "STAGE_CHANGE",
          summary: `${label} block resolved after ${blockDays} days`,
          actionId: actionId(), actorId: userIdByKey.adrian, actorName: "Adrian Koh", actorTeam: "OPS", createdAt: ts(p.block.resolvedOffset),
        });
      }
    }
  }

  // ───────────────────────── Phase 7: Partner coverage ─────────────────────────
  const lukasActor = actor("lukas");
  for (const pr of PARTNER_ROLES) {
    const entityId = entityIdByKey[pr.entity];
    for (const row of pr.coverage) {
      const coverage = await db.partnerCoverage.create({
        data: { partnerRoleId: partnerRoleIdByEntity[pr.entity], country: row.country, scheme: row.scheme as Scheme, createdAt: ts(row.changes[0].effectiveOffset) },
      });
      for (let i = 0; i < row.changes.length; i++) {
        const change = row.changes[i];
        await db.coverageStatusChange.create({
          data: {
            coverageId: coverage.id, status: change.status as CoverageStatus, effectiveDate: dateOnly(change.effectiveOffset),
            reason: change.reason, userId: userIdByKey.lukas, createdAt: ts(change.effectiveOffset),
          },
        });
        if (i > 0) {
          const prev = row.changes[i - 1];
          const label = `${row.country} / ${SCHEME_LABELS[row.scheme as Scheme]}`;
          await recordFields(db as never, {
            actionId: actionId(), entityId, objectType: "COVERAGE_ROW", objectId: coverage.id,
            objectLabel: `Coverage row: ${label}`,
            fields: [{ field: "Status", oldValue: prev.status, newValue: change.status }],
            actor: lukasActor, reason: change.reason, createdAt: ts(change.effectiveOffset),
          });
          await addHistory(db as never, {
            entityId, category: "NETWORK_AND_STRUCTURE",
            summary: `Coverage ${label}: ${prev.status.charAt(0) + prev.status.slice(1).toLowerCase()} → ${change.status.charAt(0) + change.status.slice(1).toLowerCase()} (effective ${formatDate(d(change.effectiveOffset))}). Reason: ${change.reason}.`,
            actionId: actionId(), actorId: lukasActor.userId, actorName: lukasActor.userName, actorTeam: lukasActor.userTeam,
            createdAt: ts(change.effectiveOffset),
          });
        }
      }
    }
  }

  // ───────────────────────── Phase 8: Contacts ─────────────────────────
  const contactIdByEntityAndName: Record<string, string> = {};
  for (const c of CONTACTS) {
    const entityId = entityIdByKey[c.entity];
    const ownerTeams = ownerTeamsFor(c.context, c.role as ContactRole);
    const row = await db.contact.create({
      data: {
        entityId,
        context: c.context as ContactContext,
        role: c.role as ContactRole,
        ownerTeams,
        fullName: c.fullName,
        email: contactEmail(c.fullName, c.slug),
        phone: c.phone,
        timeZone: c.timeZone,
        available24x7: c.available24x7,
        availabilityDays: c.availabilityDays,
        availabilityStart: c.availabilityStart,
        availabilityEnd: c.availabilityEnd,
        jobTitle: c.jobTitle,
        status: c.left ? "LEFT" : "ACTIVE",
        leftOn: c.left ? dateOnly(c.left.offset) : null,
        leftNote: c.left?.note ?? null,
        isPrimary: c.isPrimary,
        lastVerifiedAt: c.verifiedOffset !== null ? dateOnly(c.verifiedOffset) : null,
        lastVerifiedById: c.verifiedBy ? userIdByKey[c.verifiedBy] : null,
        createdAt: ts(c.verifiedOffset ?? -400),
      },
    });
    contactIdByEntityAndName[`${c.entity}::${c.fullName}`] = row.id;

    const label = `Contact: ${c.fullName} (${CONTACT_ROLE_LABELS[c.role as ContactRole]})`;
    const createdByActor = c.verifiedBy ? actor(c.verifiedBy) : adrianActor;
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "CONTACT", objectId: row.id, objectLabel: label,
      fields: createFields({
        "Full name": c.fullName, Role: CONTACT_ROLE_LABELS[c.role as ContactRole], Email: contactEmail(c.fullName, c.slug),
        Phone: c.phone, "Time zone": c.timeZone, "Job title": c.jobTitle,
      }),
      actor: createdByActor, createdAt: ts(c.verifiedOffset ?? -400),
    });
    await addHistory(db as never, {
      entityId, category: "CONTACT_CHANGE",
      summary: `Contact added: ${c.fullName} (${CONTACT_ROLE_LABELS[c.role as ContactRole]})`,
      actionId: actionId(), actorId: createdByActor.userId, actorName: createdByActor.userName, actorTeam: createdByActor.userTeam,
      createdAt: ts(c.verifiedOffset ?? -400),
    });

    if (c.left) {
      await recordFields(db as never, {
        actionId: actionId(), entityId, objectType: "CONTACT", objectId: row.id, objectLabel: label,
        fields: updateFields({ Status: "Active" }, { Status: "Left" }),
        actor: actor(c.entity === "santanderUk" ? "tom" : "adrian"), createdAt: ts(c.left.offset),
      });
      if (c.entity === "santanderUk" && c.fullName === "Oliver Bennett") {
        await addHistory(db as never, {
          entityId, category: "CONTACT_CHANGE",
          summary: `Oliver Bennett (Champion) marked as left`,
          actionId: actionId(), actorId: userIdByKey.tom, actorName: "Tom Hadley", actorTeam: "SALES", createdAt: ts(c.left.offset),
        });
      }
    }
  }
  // Named event: Lloyds incident contact changed (Marta Kovacs -> Paul Grant), today-20.
  await addHistory(db as never, {
    entityId: entityIdByKey.lloyds, category: "CONTACT_CHANGE",
    summary: "Incident contact changed: Primary is now Paul Grant (was Marta Kovacs)",
    actionId: actionId(), actorId: userIdByKey.lukas, actorName: "Lukas Brenner", actorTeam: "NETWORK", createdAt: ts(-20),
  });

  // ───────────────────────── Phase 9: Handoffs ─────────────────────────
  for (const h of HANDOFFS) {
    const entityId = entityIdByKey[h.entity];
    let previousHandoffId: string | undefined;
    for (const leg of h.legs) {
      const fromA = actor(leg.from);
      const toA = actor(leg.to);
      const sentAt = ts(leg.sentOffset, leg.sentTime ?? "10:00");
      const snapshot =
        leg.type === "SALES_TO_OPS"
          ? buildSalesToOpsSnapshot(h.entity)
          : buildOpsToCsSnapshot(h.entity, leg);

      const row = await db.handoff.create({
        data: {
          entityId, type: leg.type as HandoffType, status: leg.status as HandoffStatus,
          fromUserId: fromA.userId!, toUserId: toA.userId!,
          snapshot: snapshot as never,
          sentAt,
          confirmedAt: leg.type === "SALES_TO_OPS" && leg.status === "CONFIRMED" ? ts(leg.closedOffset!) : null,
          acceptedAt: leg.type === "OPS_TO_CS" && leg.status === "ACCEPTED" ? ts(leg.closedOffset!) : null,
          declinedAt: leg.status === "DECLINED" ? ts(leg.closedOffset!) : null,
          declineReason: leg.declineReason ?? null,
          previousHandoffId,
          createdAt: sentAt,
        },
      });
      previousHandoffId = row.id;

      await addHistory(db as never, {
        entityId, category: "HANDOFF",
        summary: `${leg.type === "SALES_TO_OPS" ? "Handoff" : "Handoff to Customer Success"} sent to ${toA.userName} by ${fromA.userName}`,
        actionId: actionId(), handoffId: row.id, actorId: fromA.userId, actorName: fromA.userName, actorTeam: fromA.userTeam, createdAt: sentAt,
      });

      if (leg.status === "CONFIRMED" || leg.status === "ACCEPTED") {
        const closedAt = ts(leg.closedOffset!);
        await addHistory(db as never, {
          entityId, category: "HANDOFF",
          summary: leg.type === "SALES_TO_OPS" ? `Handoff confirmed by ${toA.userName}` : `Handoff accepted by ${toA.userName}`,
          actionId: actionId(), handoffId: row.id, actorId: toA.userId, actorName: toA.userName, actorTeam: toA.userTeam, createdAt: closedAt,
        });
        const prevOwner = await db.entity.findUniqueOrThrow({ where: { id: entityId }, select: { ownerId: true } });
        await db.entity.update({ where: { id: entityId }, data: { ownerId: toA.userId, ownerSince: closedAt } });
        await addHistory(db as never, {
          entityId, category: "OWNER_REASSIGNED",
          summary: `Owner changed from ${fromA.userName} to ${toA.userName}`,
          actionId: actionId(), handoffId: row.id, actorId: toA.userId, actorName: toA.userName, actorTeam: toA.userTeam, createdAt: closedAt,
        });
        void prevOwner;
      } else if (leg.status === "DECLINED") {
        const closedAt = ts(leg.closedOffset!);
        await addHistory(db as never, {
          entityId, category: "HANDOFF",
          summary: `Handoff declined by ${toA.userName}: ${leg.declineReason}`,
          actionId: actionId(), handoffId: row.id, actorId: toA.userId, actorName: toA.userName, actorTeam: toA.userTeam, createdAt: closedAt,
        });
      }
    }
  }

  // ───────────────────────── Phase 10: Owner assignments (M9) ─────────────────────────
  for (const oa of OWNER_ASSIGNMENTS) {
    const entityId = entityIdByKey[oa.entity];
    const by = actor(oa.by);
    const toA = actor(oa.to);
    const assignedAt = ts(oa.offset, oa.time ?? "10:00");
    await db.entity.update({ where: { id: entityId }, data: { ownerId: toA.userId, ownerSince: assignedAt } });
    await db.ownerAssignment.create({
      data: {
        entityId, assigneeId: toA.userId!, assignedById: by.userId!, previousOwnerId: userIdByKey[oa.from],
        reason: oa.reason, assignedAt, acknowledgedAt: oa.acknowledgedOffset !== null ? ts(oa.acknowledgedOffset) : null,
      },
    });
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "OWNER_ASSIGNMENT", objectId: entityId,
      objectLabel: `Legal entity: ${entityByKey.get(oa.entity)!.legalName}`,
      fields: updateFields({ Owner: userByKey.get(oa.from)!.name }, { Owner: toA.userName }),
      actor: by, reason: oa.reason, createdAt: assignedAt,
    });
    await addHistory(db as never, {
      entityId, category: "OWNER_REASSIGNED",
      summary: `Owner reassigned from ${userByKey.get(oa.from)!.name} to ${toA.userName}. Reason: ${oa.reason}`,
      actionId: actionId(), actorId: by.userId, actorName: by.userName, actorTeam: by.userTeam, createdAt: assignedAt,
    });
  }

  // ───────────────────────── Phase 11: KYB and periodic review ─────────────────────────
  const meiActor = actor("mei");
  for (const k of KYB) {
    const entityId = entityIdByKey[k.entity];
    const verifier = actor(k.verifiedBy);
    const evidence = (check: string) => `https://docs.corvane-internal.example/${k.entity}/${check}.pdf`;

    const licence = await db.kybCheck.create({
      data: {
        entityId, type: "LICENCE", licenceNumber: k.licenceNumber, issuingAuthority: k.issuingAuthority,
        expiryDate: k.licenceExpiryOffset !== null ? dateOnly(k.licenceExpiryOffset) : null, noExpiry: k.licenceExpiryOffset === null,
        verifiedById: verifier.userId, verifiedOn: dateOnly(k.licenceVerifiedOffset), evidenceUrl: evidence("licence"),
        updatedAt: ts(k.licenceVerifiedOffset),
      },
    });
    const lei = await db.kybCheck.create({
      data: { entityId, type: "LEI", verifiedById: verifier.userId, verifiedOn: dateOnly(k.leiVerifiedOffset), evidenceUrl: evidence("lei"), updatedAt: ts(k.leiVerifiedOffset) },
    });
    const ownership = await db.kybCheck.create({
      data: {
        entityId, type: "OWNERSHIP_STRUCTURE", ownershipSummary: k.ownershipSummary, parentEntityName: k.parentEntityName,
        verifiedById: verifier.userId, verifiedOn: dateOnly(k.sanctionsVerifiedOffset), evidenceUrl: evidence("ownership"), updatedAt: ts(k.sanctionsVerifiedOffset),
      },
    });
    const sanctions = await db.kybCheck.create({
      data: {
        entityId, type: "SANCTIONS_SCREENING", sanctionsResult: k.sanctionsResult, sanctionsLists: "EU, UK HMT, OFAC SDN",
        verifiedById: verifier.userId, verifiedOn: dateOnly(k.sanctionsVerifiedOffset), evidenceUrl: evidence("sanctions"), updatedAt: ts(k.sanctionsVerifiedOffset),
      },
    });
    for (const [row, label, fields, offset] of [
      [licence, "Licence", { "Licence number": k.licenceNumber, "Issuing authority": k.issuingAuthority, "Expiry date": k.licenceExpiryOffset !== null ? auditDate(d(k.licenceExpiryOffset)) : null }, k.licenceVerifiedOffset],
      [lei, "LEI", { Verified: "Yes" }, k.leiVerifiedOffset],
      [ownership, "Ownership structure", { "Ownership summary": k.ownershipSummary }, k.sanctionsVerifiedOffset],
      [sanctions, "Sanctions screening", { Result: k.sanctionsResult }, k.sanctionsVerifiedOffset],
    ] as const) {
      await recordFields(db as never, {
        actionId: actionId(), entityId, objectType: "KYB_CHECK", objectId: row.id, objectLabel: `KYB: ${label}`,
        fields: createFields(fields as Record<string, string | null>), actor: verifier, createdAt: ts(offset),
      });
    }

    await db.periodicReview.create({
      data: {
        entityId, status: k.review.status, lastReviewDate: k.review.lastReviewOffset !== null ? dateOnly(k.review.lastReviewOffset) : null,
        nextReviewDate: dateOnly(k.review.nextReviewOffset), updatedAt: ts(k.sanctionsVerifiedOffset),
      },
    });
  }
  void meiActor;

  // ───────────────────────── Phase 12: Contractual obligations ─────────────────────────
  for (const o of OBLIGATIONS) {
    const entityId = entityIdByKey[o.entity];
    const role = o.kind === "CUSTOMER_AGREEMENT" ? "customer" : "partner";
    const isCustomerAgreement = o.kind === "CUSTOMER_AGREEMENT";
    const regulatoryRegime = isCustomerAgreement ? o.regulatoryRegime ?? null : null;
    const regimeName = isCustomerAgreement ? o.regimeName ?? null : null;
    const regulatorDeadline = isCustomerAgreement ? o.regulatorDeadline ?? null : null;
    const factsNeededHours = isCustomerAgreement ? o.factsNeededHours ?? null : null;
    const postIncidentReportDays = isCustomerAgreement ? o.postIncidentReportDays ?? null : null;
    const row = await db.obligationCard.create({
      data: {
        entityId, kind: o.kind as ObligationCardKind, incidentNoticeHours: o.incidentNoticeHours, subprocessorNoticeDays: o.subprocessorNoticeDays,
        auditRight: o.auditRight, availabilitySlaPct: o.availabilitySlaPct, euVopStatus: o.euVopStatus, ukCopStatus: o.ukCopStatus,
        expiryDate: o.expiryOffset !== null ? dateOnly(o.expiryOffset) : null,
        contractUrl: o.hasLink ? `https://docs.corvane-internal.example/${o.entity}/${role}-agreement.pdf` : null,
        regulatoryRegime, regimeName, regulatorDeadline, factsNeededHours, postIncidentReportDays,
        updatedById: userIdByKey.mei, updatedAt: ts(o.updatedOffset),
      },
    });
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "OBLIGATIONS", objectId: row.id, objectLabel: `Obligations: ${role === "customer" ? "Customer agreement" : "Partner agreement"}`,
      fields: createFields({
        "Incident notice (hours)": o.incidentNoticeHours?.toString() ?? null,
        "Subprocessor notice (days)": o.subprocessorNoticeDays?.toString() ?? null,
        "Audit right": auditBoolean(o.auditRight),
        "Availability SLA": o.availabilitySlaPct,
        ...(isCustomerAgreement
          ? {
              "Regulatory regime": auditEnum(regulatoryRegime, REGULATORY_REGIME_LABELS),
              "Regime name": auditText(regimeName),
              "Regulator's deadline": auditText(regulatorDeadline),
              "Facts needed within": factsNeededHours !== null ? `${factsNeededHours} hours` : null,
            }
          : {}),
      }),
      actor: meiActor, createdAt: ts(o.updatedOffset),
    });
  }

  // ───────────────────────── Phase 13: Billing profiles ─────────────────────────
  const rachelActor = actor("rachel");
  for (const b of BILLING_PROFILES) {
    const entityId = entityIdByKey[b.entity];
    const row = await db.billingProfile.create({
      data: {
        entityId, billingLegalName: b.billingLegalName, street: b.street, city: b.city, postalCode: b.postalCode,
        country: b.country, vatId: b.vatId, lei: b.lei, contractingEntity: b.contractingEntity,
        createdAt: ts(-400),
      },
    });
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "BILLING_PROFILE", objectId: row.id, objectLabel: `Legal entity: ${entityByKey.get(b.entity)!.legalName}`,
      fields: createFields({ "Billing legal name": b.billingLegalName, "VAT / tax ID": b.vatId, LEI: b.lei, "Contracting Corvane entity": b.contractingEntity }),
      actor: rachelActor, createdAt: ts(-400),
    });
  }
  void BILLING_BILLED_THROUGH;

  // ───────────────────────── Phase 14: Notes and action items ─────────────────────────
  for (const n of NOTES) {
    const entityId = entityIdByKey[n.entity];
    const author = actor(n.author);
    const row = await db.note.create({
      data: {
        entityId, type: n.type as NoteType, interactionDate: dateOnly(n.interactionOffset), summary: n.summary,
        authorId: author.userId!, authorTeam: author.userTeam, createdAt: ts(n.interactionOffset),
      },
    });
    for (const userKey of n.participantUsers) {
      await db.noteParticipant.create({ data: { noteId: row.id, kind: "USER", userId: userIdByKey[userKey], nameSnapshot: userByKey.get(userKey)!.name } });
    }
    for (const contactName of n.participantContacts) {
      const contactId = contactIdByEntityAndName[`${n.entity}::${contactName}`];
      await db.noteParticipant.create({ data: { noteId: row.id, kind: "CONTACT", contactId, nameSnapshot: contactName } });
    }
    for (let i = 0; i < n.actionItems.length; i++) {
      const ai = n.actionItems[i];
      await db.actionItem.create({
        data: {
          noteId: row.id, position: i, description: ai.description, ownerId: userIdByKey[ai.owner],
          dueDate: dateOnly(ai.dueOffset), status: ai.status as ActionItemStatus,
          statusChangedById: ai.status === "DONE" ? userIdByKey[ai.owner] : null,
          statusChangedAt: ai.status === "DONE" && ai.doneOffset !== undefined ? ts(ai.doneOffset) : null,
        },
      });
    }
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "NOTE", objectId: row.id, objectLabel: `Note: ${n.type}`,
      fields: createFields({ Type: n.type, Summary: n.summary.slice(0, 80) }),
      actor: author, createdAt: ts(n.interactionOffset),
    });
  }

  // ───────────────────────── Phase 15: Issue flow (6A, brief 7.1.17) ─────────────────────────

  // 7.1.17.2 Business hours per team: fixed mirror of lib/business-hours.ts (decision B37 -- the
  // table exists for data completeness; R1 reads the static TypeScript mirror, not this table).
  const TEAM_BUSINESS_HOURS: { team: Team; timeZone: string | null }[] = [
    { team: "OPS", timeZone: "Asia/Kuala_Lumpur" },
    { team: "NETWORK", timeZone: "Asia/Singapore" },
    { team: "COMPLIANCE", timeZone: "Asia/Singapore" },
    { team: "FINANCE", timeZone: "Asia/Singapore" },
    { team: "SALES", timeZone: null },
    { team: "CS", timeZone: null },
  ];
  for (const tbh of TEAM_BUSINESS_HOURS) {
    await db.teamBusinessHours.create({ data: { team: tbh.team, timeZone: tbh.timeZone, startTime: "09:00", endTime: "18:00", weekdays: [1, 2, 3, 4, 5] } });
  }

  // 7.1.17.3 Issue team per entity.
  for (const row of ISSUE_TEAM) {
    const entityId = entityIdByKey[row.entityKey];
    await db.issueTeamMember.createMany({
      data: [
        { entityId, team: "SALES", userId: userIdByKey[row.salesUserKey] },
        { entityId, team: "OPS", userId: userIdByKey[row.opsUserKey] },
        { entityId, team: "NETWORK", userId: userIdByKey[row.networkUserKey] },
        { entityId, team: "FINANCE", userId: userIdByKey[row.financeUserKey] },
        { entityId, team: "COMPLIANCE", userId: userIdByKey[row.complianceUserKey] },
      ],
    });
  }

  // 7.1.17.4 On-call rota: one shift per team, today-7 to today+14.
  for (const shift of ON_CALL) {
    await db.onCallShift.create({
      data: { team: shift.team, userId: userIdByKey[shift.userKey], startsAt: tsz(-7, "00:00", shift.timeZone), endsAt: tsz(14, "00:00", shift.timeZone) },
    });
  }

  // 7.1.17.5 Seed issues. Severity, routing and the compliance flag are derived with the same
  // pure functions the live report endpoint uses, so the seed can never drift from production
  // behaviour; only genuinely historical facts (who acknowledged, when, note and communication
  // text, the compliance assessment) are literal (data/issues.ts).
  function resolveIssueTime(si: SeedIssue, t: SeedIssueTime): Date {
    return si.dateKind === "wtsz" ? wtsz(t.offsetDays, t.time, t.zone) : tsz(t.offsetDays, t.time, t.zone);
  }

  for (const si of ISSUES) {
    const entityId = entityIdByKey[si.entityKey];
    const entityRow = entityByKey.get(si.entityKey)!;
    const awareAt = resolveIssueTime(si, si.awareAt);
    const savedAt = resolveIssueTime(si, si.savedAt);
    // A partner-only entity (no product line) has no customer role: its severity is never capped and no stage decides it.
    const decidingLine = si.productKey ? PRODUCTS.find((p) => p.key === si.productKey)! : PRODUCTS.find((p) => p.entity === si.entityKey);
    const customerRole = !!decidingLine;
    const decidingStage = (decidingLine?.stage ?? null) as Stage | null;
    const card = OBLIGATIONS.find((o) => o.entity === si.entityKey && o.kind === "CUSTOMER_AGREEMENT");

    const proposal = proposeSeverity({
      impact: si.impact as IssueImpact,
      possibleBreach: si.possibleBreach,
      type: si.type as IssueType,
      decidingStage,
      customerRole,
      scheme: si.scheme,
      country: si.country,
    });

    const ownerEntityRow = await db.entity.findUniqueOrThrow({
      where: { id: entityId },
      include: { owner: { select: { id: true, timeZone: true, team: true } } },
    });

    const routing = await routeIssue(
      db,
      {
        type: si.type as IssueType,
        severity: proposal.severity,
        entity: { id: entityId, legalName: entityRow.legalName, ownerId: ownerEntityRow.ownerId, owner: ownerEntityRow.owner },
        isPartnerIssue: !!si.partner,
      },
      savedAt,
    );

    const ackTarget = ACK_TARGET[proposal.severity];
    // Sales and CS follow the person's own zone (Finance, Ops, Network and Compliance the team's).
    const routedOwner = routing.ownerId ? await db.user.findUnique({ where: { id: routing.ownerId }, select: { timeZone: true, team: true } }) : null;
    const ackCal = teamCalendar(routing.ownerTeam, routedOwner);
    // Every deadline counts from Corvane aware at (a deferred, out-of-hours issue from its business start).
    const ackStartAt = ackStartFor(awareAt, routing.clocksStartAt, savedAt);
    const ackDueAt = ackTarget.business ? addBusinessMinutes(ackStartAt, ackTarget.minutes, ackCal) : new Date(ackStartAt.getTime() + ackTarget.minutes * 60_000);
    const acknowledgedAt = si.acknowledgedAt ? resolveIssueTime(si, si.acknowledgedAt) : null;

    const notifyRequired = !si.partner && (proposal.severity === "SEV1" || proposal.severity === "SEV2") && !proposal.capLabel?.includes("before go-live");
    let notifyStartAt: Date | null = null;
    let notifyTargetHours: number | null = null;
    let notifyDefaultTarget = false;
    let notifyTargetBusinessMins: number | null = null;
    let notifyDueAt: Date | null = null;
    if (notifyRequired) {
      notifyStartAt = awareAt;
      if (proposal.severity === "SEV1") {
        notifyTargetHours = card?.incidentNoticeHours ?? NOTIFY_TARGET_SEV1_DEFAULT_HOURS;
        notifyDefaultTarget = card?.incidentNoticeHours == null;
        notifyDueAt = new Date(awareAt.getTime() + notifyTargetHours * 3_600_000);
      } else {
        notifyTargetBusinessMins = NOTIFY_TARGET_SEV2_BUSINESS_MINUTES;
        notifyDueAt = addBusinessMinutes(notifyStartAt, notifyTargetBusinessMins, userCalendar(ownerEntityRow.owner!));
      }
    }
    const notifiedAt = si.notifiedAt ? resolveIssueTime(si, si.notifiedAt) : null;

    const complianceCard = card && !si.partner ? { regulatoryRegime: card.regulatoryRegime ?? null } : null;
    const reasons = complianceReasons({ possibleBreach: si.possibleBreach, type: si.type as IssueType, severity: proposal.severity }, complianceCard, !!si.partner);
    const complianceFlaggedAt = reasons.length > 0 ? savedAt : null;
    const complianceClockStartAt = reasons.length > 0 && proposal.severity === "SEV1" ? awareAt : null;
    let complianceAssessorId = si.complianceAssessment ? userIdByKey[si.complianceAssessment.assessedByKey] : null;
    let complianceVisibleFrom: Date | null = null;
    if (si.assignComplianceAssessor && reasons.length > 0) {
      const chosen = await chooseComplianceAssessor(db, entityId, proposal.severity, savedAt);
      complianceAssessorId = chosen.assessorId;
      complianceVisibleFrom = chosen.visibleFrom;
    }

    const reporterId = si.reporterKey ? userIdByKey[si.reporterKey] : null;
    const reporterTeam = si.reporterKey ? (userByKey.get(si.reporterKey)!.team as Team) : null;
    const customerReporterContactId =
      si.customerReporterKind === "CONTACT" ? contactIdByEntityAndName[`${si.customerReporterEntityKey}::${si.customerReporterContactName}`] : null;

    const issue = await db.issue.create({
      data: {
        number: si.number,
        entityId,
        productId: si.productKey ? productIdByKey[si.productKey] : null,
        scheme: si.scheme,
        country: si.country,
        type: si.type as IssueType,
        impact: si.impact as IssueImpact,
        possibleBreach: si.possibleBreach,
        proposedSeverity: proposal.severity,
        severity: proposal.severity,
        severityCapLabel: proposal.capLabel,
        stageAtReport: decidingStage,
        description: si.description,
        awareAt,
        eventAt: si.eventMinutesBeforeAware === null ? null : new Date(awareAt.getTime() - si.eventMinutesBeforeAware * 60_000),
        awarenessSource: si.awarenessSource,
        reporterKind: si.reporterKind as "USER" | "MONITORING",
        reporterId,
        reporterTeam,
        customerReporterKind: si.customerReporterKind as CustomerReporterKind,
        customerReporterContactId,
        customerReporterName: si.customerReporterContactName,
        status: acknowledgedAt ? "IN_PROGRESS" : "NEW",
        ownerTeam: routing.ownerTeam,
        ownerId: routing.ownerId,
        ownerSince: routing.ownerId ? savedAt : null,
        routingRule: routing.rule,
        routingReason: routing.routingReason,
        communicatorRule: routing.communicatorRule,
        handoverAt: routing.handoverAt,
        clocksStartAt: routing.clocksStartAt,
        ackStartAt: routing.ack ? ackStartAt : null,
        ackDueAt,
        acknowledgedAt,
        acknowledgedById: si.acknowledgedByKey ? userIdByKey[si.acknowledgedByKey] : null,
        notifyRequired,
        notifyStartAt,
        notifyTargetHours,
        notifyDefaultTarget,
        notifyTargetBusinessMins,
        notifyDueAt,
        notifiedAt,
        complianceFlaggedAt,
        complianceReasons: reasons,
        complianceClockStartAt,
        complianceAssessorId,
        complianceVisibleFrom,
        createdAt: savedAt,
      },
    });

    const contributorTeam = ISSUE_TYPE_ROUTING[si.type as IssueType].contributor;
    if (contributorTeam && !si.noDefaultContributor) {
      const teamRow = ISSUE_TEAM.find((e) => e.entityKey === si.entityKey)!;
      const contributorUserKey =
        contributorTeam === "SALES" ? teamRow.salesUserKey
        : contributorTeam === "OPS" ? teamRow.opsUserKey
        : contributorTeam === "NETWORK" ? teamRow.networkUserKey
        : contributorTeam === "FINANCE" ? teamRow.financeUserKey
        : teamRow.complianceUserKey;
      await db.issueContributor.create({ data: { issueId: issue.id, userId: userIdByKey[contributorUserKey], isDefault: true, addedAt: savedAt } });
    }

    for (const note of si.notes) {
      const noteAuthor = userByKey.get(note.authorKey)!;
      await db.issueNote.create({
        data: {
          issueId: issue.id, kind: "NOTE", body: note.body,
          authorId: userIdByKey[note.authorKey], authorName: noteAuthor.name, authorTeam: noteAuthor.team as Team,
          createdAt: resolveIssueTime(si, note.at),
        },
      });
    }

    for (const comm of si.communications) {
      const recordedBy = userByKey.get(comm.recordedByKey)!;
      await db.issueCommunication.create({
        data: {
          issueId: issue.id, type: comm.type, occurredAt: notifiedAt!, channel: comm.channel,
          contactId: contactIdByEntityAndName[`${comm.contactEntityKey}::${comm.contactName}`], personName: comm.contactName,
          message: comm.message, recordedById: userIdByKey[comm.recordedByKey], recordedByName: recordedBy.name,
          createdAt: notifiedAt!,
        },
      });
    }

    if (si.complianceAssessment) {
      const ca = si.complianceAssessment;
      const assessedAt = resolveIssueTime(si, ca.at);
      await db.complianceAssessment.create({
        data: {
          issueId: issue.id, outcome: ca.outcome, rationale: ca.rationale,
          assessedById: userIdByKey[ca.assessedByKey], assessedAt,
          factsTargetHours: ca.factsTargetHours,
          factsDueAt: ca.factsTargetHours !== null ? new Date(assessedAt.getTime() + ca.factsTargetHours * 3_600_000) : null,
        },
      });
    }

    const schemeCountry = si.scheme && si.country ? ` ${SCHEME_LABELS[si.scheme]} ${si.country}` : "";
    const creationActor = si.reporterKind === "MONITORING" ? monitoringActor : actor(si.reporterKey!);
    const reporterLabel = si.reporterKind === "MONITORING" ? "Monitoring (automatic)" : `${creationActor.userName} (${TEAM_LABELS[creationActor.userTeam as Team]})`;
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "ISSUE", objectId: issue.id, objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({
        Type: ISSUE_TYPE_LABELS[si.type as IssueType],
        Severity: SEVERITY_LABELS[proposal.severity],
        Description: si.description,
        Routing: `${TEAM_LABELS[routing.ownerTeam]}, ${routing.rule}, ${routing.routingReason}`,
      }),
      actor: creationActor, source: si.reporterKind === "MONITORING" ? "SYSTEM_ISSUE" : "USER", createdAt: savedAt,
    });
    await addHistory(db as never, {
      entityId, category: "INCIDENT",
      summary: `Issue ${issueDisplayId(issue.number)} reported by ${reporterLabel}: ${SEVERITY_LABELS[proposal.severity]}, ${ISSUE_TYPE_LABELS[si.type as IssueType]}${schemeCountry}`,
      actionId: actionId(), actorId: creationActor.userId, actorName: creationActor.userName, actorTeam: creationActor.userTeam, createdAt: savedAt,
    });

    const ownerUser = routing.ownerId ? await db.user.findUnique({ where: { id: routing.ownerId }, select: { name: true, team: true } }) : null;
    const communicatorId = effectiveCommunicator(
      { communicatorRule: routing.communicatorRule, ownerId: routing.ownerId, handoverAt: routing.handoverAt },
      { ownerId: ownerEntityRow.ownerId },
      savedAt,
    );
    const communicatorUser = communicatorId ? await db.user.findUnique({ where: { id: communicatorId }, select: { name: true, team: true } }) : null;
    await addHistory(db as never, {
      entityId, category: "INCIDENT",
      summary: ownerUser
        ? `${issueDisplayId(issue.number)} routed to ${ownerUser.name} (${TEAM_LABELS[ownerUser.team]}), communicator ${communicatorUser ? `${communicatorUser.name} (${TEAM_LABELS[communicatorUser.team]})` : "none"}`
        : `${issueDisplayId(issue.number)} routed: queued for the start of ${TEAM_LABELS[routing.ownerTeam]} business hours`,
      actionId: actionId(), actorId: creationActor.userId, actorName: creationActor.userName, actorTeam: creationActor.userTeam, createdAt: savedAt,
    });

    if (si.acknowledgedByKey && acknowledgedAt) {
      const ackByUser = userByKey.get(si.acknowledgedByKey)!;
      await addHistory(db as never, {
        entityId, category: "INCIDENT",
        summary: `${issueDisplayId(issue.number)} acknowledged by ${ackByUser.name}`,
        actionId: actionId(), actorId: userIdByKey[si.acknowledgedByKey], actorName: ackByUser.name, actorTeam: ackByUser.team as Team, createdAt: acknowledgedAt,
      });
    }

    for (const comm of si.communications) {
      const recordedBy = userByKey.get(comm.recordedByKey)!;
      await addHistory(db as never, {
        entityId, category: "INCIDENT",
        summary: `${issueDisplayId(issue.number)}: First notification to ${comm.contactName} by ${comm.channel === "EMAIL" ? "Email" : "Phone"}, recorded by ${recordedBy.name}`,
        actionId: actionId(), actorId: userIdByKey[comm.recordedByKey], actorName: recordedBy.name, actorTeam: recordedBy.team as Team, createdAt: notifiedAt!,
      });
    }

    if (si.complianceAssessment) {
      const ca = si.complianceAssessment;
      const assessedByUser = userByKey.get(ca.assessedByKey)!;
      await addHistory(db as never, {
        entityId, category: "INCIDENT",
        summary: `${issueDisplayId(issue.number)}: Compliance assessment "${ca.outcome === "POSSIBLE_MAJOR_INCIDENT" ? "Possible major incident" : ca.outcome === "POSSIBLE_DATA_BREACH" ? "Possible data breach" : "Neither"}" recorded by ${assessedByUser.name}`,
        actionId: actionId(), actorId: userIdByKey[ca.assessedByKey], actorName: assessedByUser.name, actorTeam: assessedByUser.team as Team, createdAt: resolveIssueTime(si, ca.at),
      });
    }
  }

  // Next report after the seed is ISS-1043 (brief 7.1.17.5).
  await db.$executeRawUnsafe("SELECT setval('issue_number_seq', 1042)");

  // ───────────────────────── Phase 16: Lifecycle, Inactive, deletion ─────────────────────────
  for (const e of ENTITIES) {
    const entityId = entityIdByKey[e.key];
    if (e.inactive) {
      const setBy = actor(e.inactive.setBy);
      await db.entity.update({ where: { id: entityId }, data: { lifecycleState: "INACTIVE", inactiveReason: e.inactive.reason } });
      await recordFields(db as never, {
        actionId: actionId(), entityId, objectType: "LEGAL_ENTITY", objectId: entityId, objectLabel: `Legal entity: ${e.legalName}`,
        fields: updateFields({ "Lifecycle state": LIFECYCLE_LABELS.BAU }, { "Lifecycle state": LIFECYCLE_LABELS.INACTIVE }),
        actor: setBy, reason: e.inactive.reason, createdAt: ts(e.inactive.setOffset),
      });
      await addHistory(db as never, {
        entityId, category: "NETWORK_AND_STRUCTURE", summary: "Lifecycle state: BAU → Inactive",
        actionId: actionId(), actorId: setBy.userId, actorName: setBy.userName, actorTeam: setBy.userTeam, createdAt: ts(e.inactive.setOffset),
      });
      continue;
    }

    const products = PRODUCTS.filter((p) => p.entity === e.key && !p.block?.resolvedOffset === false);
    const activeStages = PRODUCTS.filter((p) => p.entity === e.key).map((p) => p.stage as Stage);
    const partnerRole = PARTNER_ROLES.find((p) => p.entity === e.key);
    const hasActiveOrDegraded = partnerRole?.coverage.some((c) => {
      const current = [...c.changes].filter((ch) => ch.effectiveOffset <= 0).pop();
      return current && (current.status === "ACTIVE" || current.status === "DEGRADED");
    }) ?? false;
    void products;

    const lifecycle = computeLifecycle({
      isInactive: false,
      activeProductStages: activeStages,
      hasActivePartnerRole: e.roles.includes("P"),
      partnerHasActiveOrDegradedCoverage: hasActiveOrDegraded,
    });
    await db.entity.update({ where: { id: entityId }, data: { lifecycleState: lifecycle } });
  }

  // lloydsLegacy: soft delete.
  {
    const e = entityByKey.get("lloydsLegacy")!;
    const entityId = entityIdByKey.lloydsLegacy;
    const deletedBy = actor(e.deleted!.by);
    const deletedAt = ts(e.deleted!.offsetDays, e.deleted!.time);
    await db.entity.update({
      where: { id: entityId },
      data: { deletedAt, deletedById: deletedBy.userId, deleteReason: e.deleted!.reason },
    });
    await recordFields(db as never, {
      actionId: actionId(), entityId, objectType: "LEGAL_ENTITY", objectId: entityId, objectLabel: "Record status",
      fields: updateFields({ "Record status": "Active" }, { "Record status": "Deleted" }),
      actor: deletedBy, reason: e.deleted!.reason, createdAt: deletedAt,
    });
    await addHistory(db as never, {
      entityId, category: "NETWORK_AND_STRUCTURE", summary: `Record status: Active → Deleted. Reason: ${e.deleted!.reason}`,
      actionId: actionId(), actorId: deletedBy.userId, actorName: deletedBy.userName, actorTeam: deletedBy.userTeam, createdAt: deletedAt,
    });
  }

  // ───────────────────────── Phase 17: Demo meta ─────────────────────────
  await db.demoMeta.upsert({ where: { id: 1 }, create: { id: 1, seedVersion: 1 }, update: { seedVersion: { increment: 1 } } });

  // ---- local snapshot builders (brief 3.2.5) ----
  function buildSalesToOpsSnapshot(entityKey: string) {
    const e = entityByKey.get(entityKey)!;
    const products = PRODUCTS.filter((p) => p.entity === entityKey);
    const card = CUSTOMER_ROLE_CARDS.find((c) => c.entity === entityKey);
    return {
      v: 1, type: "SALES_TO_OPS",
      entity: { legalName: e.legalName, lei: e.lei, leiStatus: "ISSUED", type: e.type, country: e.country, groupName: e.group ?? null, standalone: !e.group, bics: e.bics, aliases: e.aliases },
      products: products.map((p) => ({ product: p.product, country: p.country, contractingEntityName: e.legalName, targetGoLive: d(p.targetGoLiveOffset) })),
      commercialTerms: {
        currency: card?.currency ?? "EUR", pricePerVerification: card?.pricePerVerification ?? "0",
        volumeTiers: card?.tiers ?? [], monthlyMinimum: card?.monthlyMinimum ?? null, paymentTermDays: card?.paymentTermDays ?? 30,
      },
      slas: { availabilityPct: card?.slaAvailabilityPct ?? null, maxResponseMs: card?.slaMaxResponseMs ?? null, other: card?.slaOther ?? null },
      specialTerms: card?.specialTerms ?? null, entitiesNotInPortal: null, notesForOnboarding: card?.notesForOnboarding ?? null,
      contacts: CONTACTS.filter((c) => c.entity === entityKey && c.context === "CUSTOMER").map((c) => ({ role: c.role, fullName: c.fullName, email: contactEmail(c.fullName, c.slug), phone: c.phone, jobTitle: c.jobTitle })),
    };
  }

  function buildOpsToCsSnapshot(entityKey: string, leg: (typeof HANDOFFS)[number]["legs"][number]) {
    const products = PRODUCTS.filter((p) => p.entity === entityKey);
    return {
      v: 1, type: "OPS_TO_CS",
      products: products.map((p) => ({ productId: productIdByKey[p.key], product: p.product, country: p.country, stage: p.stage, stageEnteredAt: d(p.stageEnteredOffset), billableFrom: p.billableFromOffset !== null ? d(p.billableFromOffset) : null })),
      blocks: products.filter((p) => p.block && !p.block.resolvedOffset).map((p) => ({ productId: productIdByKey[p.key], product: p.product, country: p.country, blockedBy: p.block!.blockedBy, reason: p.block!.reason, blockedSince: d(p.block!.setOffset), handoffNote: leg.blockHandoffNote ?? "" })),
      commitments: (leg.commitments ?? []).map((c) => ({ description: c.description, dueDate: c.dueOffset !== null ? d(c.dueOffset) : null })),
      noOpenCommitments: leg.noOpenCommitments ?? false,
      contacts: CONTACTS.filter((c) => c.entity === entityKey && c.context === "CUSTOMER" && (c.role === "TECHNICAL" || c.role === "INCIDENT")).map((c) => ({
        contactId: contactIdByEntityAndName[`${entityKey}::${c.fullName}`], role: c.role, fullName: c.fullName, email: contactEmail(c.fullName, c.slug), phone: c.phone,
        lastVerifiedAt: c.verifiedOffset !== null ? d(c.verifiedOffset) : null, ownedByOps: c.role === "TECHNICAL", confirmed: true,
      })),
      noChampionWarning: !CONTACTS.some((c) => c.entity === entityKey && c.role === "CHAMPION" && !c.left),
      noteForCsm: leg.noteForCsm ?? null,
    };
  }
}
