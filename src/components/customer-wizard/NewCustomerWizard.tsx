"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  createWizardEntitySchema,
  createWizardProductsStepSchema,
  wizardContactsStepSchema,
  wizardHandoffStepSchema,
  type CreateCustomerInput,
} from "@/lib/validation/customer-wizard";
import { Stepper } from "@/components/customer-wizard/Stepper";
import { Step1Entity, step1Blocked } from "@/components/customer-wizard/Step1Entity";
import { Step2Products } from "@/components/customer-wizard/Step2Products";
import { Step3Contacts, emptyContact } from "@/components/customer-wizard/Step3Contacts";
import { Step4Handoff } from "@/components/customer-wizard/Step4Handoff";
import type { ContactsState, DuplicateMatch, EntityState, FieldErrors, HandoffState, ProductsState } from "@/components/customer-wizard/types";

const SELF_CONTRACTING_ENTITY_ID = "__self__";

function emptyEntity(): EntityState {
  return {
    lei: "",
    legalName: "",
    country: "",
    type: "",
    groupId: null,
    groupSuggested: false,
    bics: [],
    aliases: [],
    gleif: null,
    gleifLookup: null,
    confirmDuplicate: false,
    duplicateReason: "",
  };
}

function emptyProducts(): ProductsState {
  return {
    productLines: [],
    currency: "EUR",
    pricePerVerification: "",
    volumeTiers: [],
    monthlyMinimum: "",
    paymentTermDays: "",
    availabilityPct: "",
    maxResponseMs: "",
    slaOther: "",
    specialTerms: "",
  };
}

function zodErrorsToFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function buildProductsPayload(products: ProductsState): CreateCustomerInput["products"] {
  return {
    productLines: products.productLines.map((l) => ({
      product: l.product as CreateCustomerInput["products"]["productLines"][number]["product"],
      country: l.country,
      contractingEntityId: l.contractingEntityId,
      targetGoLive: l.targetGoLive,
    })),
    commercialTerms: {
      currency: products.currency,
      pricePerVerification: products.pricePerVerification === "" ? NaN : products.pricePerVerification,
      volumeTiers: products.volumeTiers.map((t) => ({
        fromVolume: t.fromVolume,
        toVolume: t.toVolume,
        pricePerVerification: t.pricePerVerification === "" ? NaN : t.pricePerVerification,
      })),
      monthlyMinimum: products.monthlyMinimum === "" ? null : products.monthlyMinimum,
      paymentTermDays: products.paymentTermDays === "" ? NaN : products.paymentTermDays,
    },
    slas: {
      availabilityPct: products.availabilityPct === "" ? null : products.availabilityPct,
      maxResponseMs: products.maxResponseMs === "" ? null : products.maxResponseMs,
      other: products.slaOther.trim() || null,
    },
    specialTerms: products.specialTerms.trim() || null,
    entitiesNotInPortal: null,
  };
}

function daysInRange(from: number, to: number): number[] {
  const days: number[] = [];
  let d = from;
  while (true) {
    days.push(d);
    if (d === to) break;
    d = d === 7 ? 1 : d + 1;
  }
  return days;
}

function buildContactsPayload(contacts: ContactsState): CreateCustomerInput["contacts"] {
  return {
    contacts: contacts.contacts.map((c) => ({
      role: c.role as CreateCustomerInput["contacts"]["contacts"][number]["role"],
      fullName: c.fullName,
      email: c.email,
      phone: c.phone.trim() || null,
      timeZone: c.timeZone.trim() || null,
      jobTitle: c.jobTitle.trim() || null,
      availability: c.available24x7
        ? { available24x7: true as const }
        : { available24x7: false as const, days: daysInRange(c.fromDay, c.toDay), start: c.start, end: c.end },
    })),
  };
}

export function NewCustomerWizard({
  countries,
  sepaCountries,
  groups,
  opsUsers,
  isAdmin,
  zone,
}: {
  countries: { code: string; name: string }[];
  sepaCountries: readonly string[];
  groups: { id: string; name: string }[];
  opsUsers: { id: string; name: string }[];
  isAdmin: boolean;
  zone: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [entity, setEntity] = React.useState<EntityState>(emptyEntity);
  const [products, setProducts] = React.useState<ProductsState>(emptyProducts);
  const [contacts, setContacts] = React.useState<ContactsState>({ contacts: [emptyContact()] });
  const [handoff, setHandoff] = React.useState<HandoffState>({ notesForOnboarding: "", onboardingManagerId: "" });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = React.useState(false);
  const [groupMembers, setGroupMembers] = React.useState<{ id: string; legalName: string }[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const validBicCountryCodes = React.useMemo(() => new Set(countries.map((c) => c.code)), [countries]);

  // Brief 3.6 "debounced 400ms on the client". No synchronous setState on
  // the no-GLEIF-yet path: entity.gleif only ever transitions null ->
  // found (never back), duplicates already defaults to [], and the
  // visible list below is gated on entity.gleif anyway.
  const aliasesKey = JSON.stringify(entity.aliases);
  const bicsKey = JSON.stringify(entity.bics);
  React.useEffect(() => {
    if (!entity.gleif) return;
    let active = true;
    const timer = setTimeout(() => {
      setDuplicatesLoading(true);
      apiRequest<DuplicateMatch[]>("/api/duplicates/check", "POST", {
        lei: entity.lei,
        bics: entity.bics,
        legalName: entity.legalName,
        aliases: entity.aliases,
      })
        .then((result) => {
          if (active && result.ok) setDuplicates(result.data);
        })
        .finally(() => {
          if (active) setDuplicatesLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.gleif, entity.legalName, entity.lei, aliasesKey, bicsKey]);

  // Same reasoning: groupMembers is only ever consumed through
  // contractingEntityOptions below, which already falls back to [] when
  // no group is selected, so the effect never needs to reset it itself.
  React.useEffect(() => {
    if (!entity.groupId) return;
    let active = true;
    apiRequest<{ id: string; legalName: string }[]>(`/api/groups/${entity.groupId}/members`, "POST").then((result) => {
      if (active && result.ok) setGroupMembers(result.data);
    });
    return () => {
      active = false;
    };
  }, [entity.groupId]);

  const contractingEntityOptions = React.useMemo(
    () => [{ id: SELF_CONTRACTING_ENTITY_ID, legalName: entity.legalName || "This entity" }, ...(entity.groupId ? groupMembers : [])],
    [entity.legalName, entity.groupId, groupMembers],
  );
  const contractingEntityNames = React.useMemo(() => new Map(contractingEntityOptions.map((o) => [o.id, o.legalName])), [contractingEntityOptions]);
  const groupName = groups.find((g) => g.id === entity.groupId)?.name ?? null;

  function goNext() {
    setErrors({});
    if (step === 1) {
      const schema = createWizardEntitySchema(validBicCountryCodes);
      const result = schema.safeParse({
        lei: entity.lei,
        legalName: entity.legalName,
        country: entity.country,
        type: entity.type,
        groupId: entity.groupId,
        bics: entity.bics,
        aliases: entity.aliases,
        gleif: entity.gleif,
      });
      if (!result.success) {
        setErrors(zodErrorsToFieldErrors(result.error));
        return;
      }
      if (duplicates.length > 0 && (!entity.confirmDuplicate || entity.duplicateReason.trim().length < 10)) {
        setErrors({ duplicateReason: ["Enter a reason of 10 to 500 characters"] });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const schema = createWizardProductsStepSchema(sepaCountries);
      const result = schema.safeParse(buildProductsPayload(products));
      if (!result.success) {
        setErrors(zodErrorsToFieldErrors(result.error));
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const result = wizardContactsStepSchema.safeParse(buildContactsPayload(contacts));
      if (!result.success) {
        setErrors(zodErrorsToFieldErrors(result.error));
        return;
      }
      setStep(4);
    }
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    const handoffResult = wizardHandoffStepSchema.safeParse({
      notesForOnboarding: handoff.notesForOnboarding.trim() || null,
      onboardingManagerId: handoff.onboardingManagerId,
    });
    if (!handoffResult.success) {
      setErrors(zodErrorsToFieldErrors(handoffResult.error));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CreateCustomerInput = {
        entity: {
          lei: entity.lei,
          legalName: entity.legalName,
          country: entity.country,
          type: entity.type as CreateCustomerInput["entity"]["type"],
          groupId: entity.groupId,
          bics: entity.bics,
          aliases: entity.aliases,
          gleif: entity.gleif!,
        },
        duplicateAck: duplicates.length > 0 ? { confirmDuplicate: true, duplicateReason: entity.duplicateReason } : null,
        products: buildProductsPayload(products),
        contacts: buildContactsPayload(contacts),
        handoff: handoffResult.data,
      };
      const result = await apiRequest<{ id: string }>("/api/customers", "POST", payload);
      if (!result.ok) {
        if (result.kind === "validation") setErrors(result.fieldErrors);
        setSubmitError("The customer could not be created. Nothing was saved. Try again.");
        return;
      }
      const omName = opsUsers.find((u) => u.id === handoff.onboardingManagerId)?.name ?? "";
      toast.success(`${entity.legalName} created and handed over to ${omName}`);
      router.push(`/entities/${result.data.id}/overview`);
    } finally {
      setSubmitting(false);
    }
  }

  const nextBlocked = step === 1 && step1Blocked(entity, duplicates.length > 0);

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex items-center gap-2">
        <h1 className="text-page flex-1">New customer</h1>
        <Button type="button" variant="text" onClick={() => router.push("/search")}>
          Cancel
        </Button>
      </div>
      <Stepper current={step} />

      {step === 1 && (
        <Step1Entity entity={entity} setEntity={setEntity} groups={groups} errors={errors} duplicates={duplicates} duplicatesLoading={duplicatesLoading} isAdmin={isAdmin} zone={zone} />
      )}
      {step === 2 && (
        <Step2Products products={products} setProducts={setProducts} countries={countries} contractingEntityOptions={contractingEntityOptions} errors={errors} />
      )}
      {step === 3 && <Step3Contacts state={contacts} setState={setContacts} errors={errors} />}
      {step === 4 && (
        <Step4Handoff
          entity={entity}
          products={products}
          contacts={contacts}
          handoff={handoff}
          setHandoff={setHandoff}
          groupName={groupName}
          contractingEntityNames={contractingEntityNames}
          opsUsers={opsUsers}
          onEditStep={(s) => setStep(s)}
          onBack={goBack}
          errors={errors}
          submitting={submitting}
          submitError={submitError}
          onSubmit={() => void submit()}
          onRetry={() => setSubmitError(null)}
        />
      )}

      {step < 4 && (
        <div className="flex items-center gap-2 border-t border-border pt-4">
          {step > 1 && (
            <Button type="button" variant="secondary" onClick={goBack}>
              Back
            </Button>
          )}
          <span className="flex-1" />
          <Button type="button" onClick={goNext} disabled={nextBlocked}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
