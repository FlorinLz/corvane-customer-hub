import { createFields } from "@/server/audit/record";
import { auditArray, auditDate, auditDecimal, auditEnum } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { now, today } from "@/lib/dates";
import { normaliseCore, normaliseSearch } from "@/lib/validation/normalise";
import { ENTITY_TYPE_LABELS, LEI_STATUS_LABELS, SCHEME_LABELS, CONTACT_ROLE_LABELS } from "@/lib/labels";
import type { CreateCustomerInput } from "@/lib/validation/customer-wizard";
import type { SalesToOpsSnapshot } from "@/server/services/handoff.types";
import { checkDuplicates } from "@/server/duplicates";
import { ISSUE_TEAM_DEFAULTS } from "@/server/config";
import { ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { contactOwnerTeams } from "@/server/derived/contact-ownership";

function availabilityFields(availability: CreateCustomerInput["contacts"]["contacts"][number]["availability"]) {
  if (!availability) return { available24x7: false, availabilityDays: [], availabilityStart: null, availabilityEnd: null };
  if (availability.available24x7) return { available24x7: true, availabilityDays: [], availabilityStart: null, availabilityEnd: null };
  return { available24x7: false, availabilityDays: availability.days, availabilityStart: availability.start, availabilityEnd: availability.end };
}

function availabilityAuditValue(availability: CreateCustomerInput["contacts"]["contacts"][number]["availability"]): string | null {
  if (!availability) return null;
  if (availability.available24x7) return "24/7";
  return `${auditArray(availability.days.map(String))} ${availability.start}-${availability.end}`;
}

/**
 * Brief 3.8.2 "Create customer", M2 AC12-AC19, M3 AC10, AC16, AC17. Sales.
 * R1 shape only: no group creation, no existingEntityId branch (both R2) —
 * see DECISIONS.md.
 */
export async function createCustomer(user: SessionUser, input: CreateCustomerInput) {
  assertCan(user, "customer.create");

  const duplicates = await checkDuplicates({
    lei: input.entity.lei,
    bics: input.entity.bics,
    legalName: input.entity.legalName,
    aliases: input.entity.aliases,
  });
  if (duplicates.length > 0 && !input.duplicateAck) {
    throw new ValidationError({ confirmDuplicate: ["Check the possible duplicates and confirm this is a different legal entity"] });
  }

  const ctx: { entityId: string | null } = { entityId: null };
  return mutate(user, ctx, async (tx, log) => {
    const legalName = input.entity.legalName;
    const checkedAt = new Date(input.entity.gleif.gleifCheckedAt);

    const entity = await tx.entity.create({
      data: {
        legalName,
        legalNameSearch: normaliseSearch(legalName),
        legalNameCore: normaliseCore(legalName),
        type: input.entity.type,
        country: input.entity.country,
        lei: input.entity.lei,
        leiStatus: input.entity.gleif.leiStatus,
        gleifRawStatus: input.entity.gleif.gleifRawStatus,
        leiNextRenewalDate: input.entity.gleif.leiNextRenewalDate ? new Date(input.entity.gleif.leiNextRenewalDate) : null,
        gleifCheckedAt: checkedAt,
        gleifSource: input.entity.gleif.gleifSource,
        gleifLegalName: input.entity.gleif.gleifLegalName,
        gleifCountry: input.entity.gleif.gleifCountry,
        gleifDirectParentLei: input.entity.gleif.gleifDirectParentLei,
        gleifDirectParentName: input.entity.gleif.gleifDirectParentName,
        gleifUltimateParentLei: input.entity.gleif.gleifUltimateParentLei,
        gleifUltimateParentName: input.entity.gleif.gleifUltimateParentName,
        gleifSuccessorLei: input.entity.gleif.gleifSuccessorLei,
        groupId: input.entity.groupId ?? null,
        groupDecision: input.entity.groupId ? "GROUP" : "NOT_SET",
        ownerId: user.id,
        ownerSince: now(),
        createdById: user.id,
      },
    });
    ctx.entityId = entity.id;

    // Brief 7.1.17.3: the customer-create service writes the same issue
    // team defaults as the seed, with the creating Sales user as the
    // Sales person (milestone 6A).
    const issueTeamUsers = await tx.user.findMany({
      where: { email: { in: Object.values(ISSUE_TEAM_DEFAULTS) } },
      select: { id: true, email: true },
    });
    const issueTeamUserIdByEmail = new Map(issueTeamUsers.map((u) => [u.email, u.id]));
    await tx.issueTeamMember.createMany({
      data: [
        { entityId: entity.id, team: "SALES", userId: user.id },
        { entityId: entity.id, team: "OPS", userId: issueTeamUserIdByEmail.get(ISSUE_TEAM_DEFAULTS.OPS)! },
        { entityId: entity.id, team: "NETWORK", userId: issueTeamUserIdByEmail.get(ISSUE_TEAM_DEFAULTS.NETWORK)! },
        { entityId: entity.id, team: "FINANCE", userId: issueTeamUserIdByEmail.get(ISSUE_TEAM_DEFAULTS.FINANCE)! },
        { entityId: entity.id, team: "COMPLIANCE", userId: issueTeamUserIdByEmail.get(ISSUE_TEAM_DEFAULTS.COMPLIANCE)! },
      ],
    });

    // Rows go in one insert per kind, not one per row: this is one transaction clocked from its start, and on a database
    // a network hop away every extra statement is tens of milliseconds.
    if (input.entity.aliases.length > 0) {
      await tx.entityAlias.createMany({
        data: input.entity.aliases.map((alias) => ({ entityId: entity.id, alias, aliasSearch: normaliseSearch(alias), aliasCore: normaliseCore(alias) })),
      });
    }
    if (input.entity.bics.length > 0) {
      await tx.entityBic.createMany({
        data: input.entity.bics.map((bic) => {
          const upper = bic.trim().toUpperCase();
          return { entityId: entity.id, bic: upper, bic8: upper.slice(0, 8) };
        }),
      });
    }

    const group = input.entity.groupId ? await tx.group.findUnique({ where: { id: input.entity.groupId } }) : null;

    const customerRole = await tx.customerRole.create({
      data: {
        entityId: entity.id,
        active: true,
        createdById: user.id,
        currency: input.products.commercialTerms.currency,
        pricePerVerification: input.products.commercialTerms.pricePerVerification,
        monthlyMinimum: input.products.commercialTerms.monthlyMinimum,
        paymentTermDays: input.products.commercialTerms.paymentTermDays,
        slaAvailabilityPct: input.products.slas.availabilityPct,
        slaMaxResponseMs: input.products.slas.maxResponseMs,
        slaOther: input.products.slas.other,
        specialTerms: input.products.specialTerms,
        entitiesNotInPortal: input.products.entitiesNotInPortal,
        notesForOnboarding: input.handoff.notesForOnboarding,
        volumeTiers: {
          create: input.products.commercialTerms.volumeTiers.map((tier, i) => ({
            position: i,
            fromVolume: tier.fromVolume,
            toVolume: tier.toVolume,
            pricePerVerification: tier.pricePerVerification,
          })),
        },
      },
    });

    const contractingEntityNames = new Map<string, string>([[entity.id, entity.legalName]]);
    for (const member of group ? await tx.entity.findMany({ where: { groupId: group.id }, select: { id: true, legalName: true } }) : []) {
      contractingEntityNames.set(member.id, member.legalName);
    }

    // The client offers the entity being created itself as a contracting-entity
    // option before it has a real id; "__self__" is that sentinel.
    const lines = input.products.productLines.map((line) => ({ line, contractingEntityId: line.contractingEntityId === "__self__" ? entity.id : line.contractingEntityId }));
    await tx.contractedProduct.createMany({
      data: lines.map(({ line, contractingEntityId }) => ({
        entityId: entity.id,
        contractingEntityId,
        product: line.product,
        country: line.country,
        stage: "CONTRACT_SIGNED" as const,
        stageEnteredAt: new Date(today()),
        targetGoLive: new Date(line.targetGoLive),
      })),
    });
    await log.changes(
      lines.map(({ line }) => ({
        objectType: "CONTRACTED_PRODUCT" as const,
        objectId: entity.id,
        objectLabel: `Product line: ${SCHEME_LABELS[line.product]} / ${line.country}`,
        fields: createFields({ Product: SCHEME_LABELS[line.product], Country: line.country, "Target go-live": auditDate(line.targetGoLive) }),
      })),
    );
    await log.histories(lines.map(() => ({ category: "STAGE_CHANGE" as const, summary: "Product line added" })));
    const createdProducts: { product: (typeof input.products.productLines)[number]["product"]; country: string; contractingEntityName: string; targetGoLive: string }[] = lines.map(
      ({ line, contractingEntityId }) => ({
        product: line.product,
        country: line.country,
        contractingEntityName: contractingEntityNames.get(contractingEntityId) ?? "",
        targetGoLive: line.targetGoLive,
      }),
    );

    const contactInputs = input.contacts.contacts.map((contact) => ({ contact, phone: contact.phone?.trim() || null }));
    const contactRows = await tx.contact.createManyAndReturn({
      data: contactInputs.map(({ contact, phone }) => ({
        entityId: entity.id,
        context: "CUSTOMER" as const,
        role: contact.role,
        ownerTeams: contactOwnerTeams("CUSTOMER", contact.role),
        fullName: contact.fullName,
        email: contact.email,
        phone,
        timeZone: contact.timeZone?.trim() || null,
        jobTitle: contact.jobTitle?.trim() || null,
        lastVerifiedAt: new Date(today()),
        lastVerifiedById: user.id,
        ...availabilityFields(contact.availability),
      })),
      select: { id: true, email: true, role: true },
    });
    contactRows.forEach((row, i) => {
      if (row.email !== contactInputs[i].contact.email || row.role !== contactInputs[i].contact.role) throw new Error("createManyAndReturn returned the contacts out of order");
    });
    await log.changes(
      contactInputs.map(({ contact, phone }, i) => ({
        objectType: "CONTACT" as const,
        objectId: contactRows[i].id,
        objectLabel: `Contact: ${contact.fullName} (${CONTACT_ROLE_LABELS[contact.role]})`,
        fields: createFields({
          "Full name": contact.fullName,
          Role: CONTACT_ROLE_LABELS[contact.role],
          Email: contact.email,
          Phone: phone,
          "Job title": contact.jobTitle ?? null,
          Availability: availabilityAuditValue(contact.availability),
        }),
      })),
    );
    const createdContacts: SalesToOpsSnapshot["contacts"] = contactInputs.map(({ contact, phone }) => ({
      role: contact.role,
      fullName: contact.fullName,
      email: contact.email,
      phone,
      jobTitle: contact.jobTitle ?? null,
    }));

    const omName = (await tx.user.findUnique({ where: { id: input.handoff.onboardingManagerId }, select: { name: true } }))?.name ?? "";

    const snapshot: SalesToOpsSnapshot = {
      v: 1,
      type: "SALES_TO_OPS",
      entity: {
        legalName: entity.legalName,
        lei: entity.lei,
        leiStatus: entity.leiStatus,
        type: entity.type,
        country: entity.country,
        groupName: group?.name ?? null,
        standalone: !group,
        bics: input.entity.bics,
        aliases: input.entity.aliases,
      },
      products: createdProducts,
      commercialTerms: {
        currency: input.products.commercialTerms.currency,
        pricePerVerification: String(input.products.commercialTerms.pricePerVerification),
        volumeTiers: input.products.commercialTerms.volumeTiers.map((t) => ({
          fromVolume: t.fromVolume,
          toVolume: t.toVolume,
          pricePerVerification: String(t.pricePerVerification),
        })),
        monthlyMinimum: input.products.commercialTerms.monthlyMinimum === null ? null : String(input.products.commercialTerms.monthlyMinimum),
        paymentTermDays: input.products.commercialTerms.paymentTermDays,
      },
      slas: {
        availabilityPct: input.products.slas.availabilityPct === null ? null : String(input.products.slas.availabilityPct),
        maxResponseMs: input.products.slas.maxResponseMs,
        other: input.products.slas.other,
      },
      specialTerms: input.products.specialTerms,
      entitiesNotInPortal: input.products.entitiesNotInPortal,
      notesForOnboarding: input.handoff.notesForOnboarding,
      contacts: createdContacts,
    };

    const handoffSentAt = now();
    const handoff = await tx.handoff.create({
      data: {
        entityId: entity.id,
        type: "SALES_TO_OPS",
        status: "SENT",
        fromUserId: user.id,
        toUserId: input.handoff.onboardingManagerId,
        sentAt: handoffSentAt,
        snapshot,
        createdAt: handoffSentAt,
      },
    });

    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entity.id,
      objectLabel: "Legal entity",
      fields: createFields({
        "Legal name": entity.legalName,
        LEI: entity.lei,
        "LEI status": auditEnum(entity.leiStatus, LEI_STATUS_LABELS),
        Type: auditEnum(entity.type, ENTITY_TYPE_LABELS),
        Country: entity.country,
        Group: group?.name ?? null,
        BICs: auditArray(input.entity.bics),
        Aliases: auditArray(input.entity.aliases),
      }),
      reason: input.duplicateAck?.duplicateReason,
    });
    await log.change({
      objectType: "CUSTOMER_ROLE",
      objectId: customerRole.id,
      objectLabel: "Customer role",
      fields: createFields({
        Currency: input.products.commercialTerms.currency,
        "Price per verification": auditDecimal(input.products.commercialTerms.pricePerVerification),
        "Monthly minimum": auditDecimal(input.products.commercialTerms.monthlyMinimum),
        "Payment term days": String(input.products.commercialTerms.paymentTermDays),
      }),
    });
    await log.change({
      objectType: "HANDOFF",
      objectId: handoff.id,
      objectLabel: "Handoff",
      fields: createFields({ "Sent to": omName, Type: "Sales to Ops" }),
    });

    await log.history({ category: "NETWORK_AND_STRUCTURE", summary: `Record created by ${user.name} (Sales)` });
    if (input.duplicateAck) {
      await log.history({ category: "NETWORK_AND_STRUCTURE", summary: `Duplicate warning acknowledged: ${input.duplicateAck.duplicateReason}` });
    }
    await log.history({ category: "HANDOFF", summary: `Handoff sent to ${omName} by ${user.name}`, handoffId: handoff.id });

    return { id: entity.id };
  });
}
