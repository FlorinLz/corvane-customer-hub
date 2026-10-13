"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IssueImpact, IssueType, Scheme, Stage } from "@prisma/client";

import { apiGet, apiRequest } from "@/lib/api-client";
import { proposeSeverity } from "@/server/derived/severity";
import { TYPES_REQUIRING_SCHEME } from "@/lib/validation/issues";
import { COVERAGE_STATUS_LABELS, ISSUE_IMPACT_LABELS, ISSUE_STATUS_LABELS, ISSUE_TYPE_LABELS, SCHEME_LABELS, SEVERITY_LABELS, STAGE_ORDER, TEAM_LABELS, issueDisplayId } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { SuggestCombobox, type SuggestOption } from "@/components/issues/SuggestCombobox";
import { TimesFields, timesBody, timesFormFrom, timesValid, type TimesFormState } from "@/components/issues/TimeFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DrawerContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";

const TYPES = Object.values(IssueType);
const IMPACTS = Object.values(IssueImpact);

interface ProductLine {
  id: string;
  scheme: Scheme;
  country: string;
  stage: Stage;
  label: string;
}
interface Contact {
  id: string;
  fullName: string;
  role: string;
}
interface IssueContext {
  customerRoleActive: boolean;
  isPartnerOnly: boolean;
  productLines: ProductLine[];
  contacts: Contact[];
  coverageRows: { scheme: Scheme; country: string }[];
  /** The partner's coverages (its Partner tab) that are not retired, with their current status. */
  partnerCoverages: { scheme: Scheme; country: string; status: string }[];
  registeredCountry: string | null;
  countries: { code: string; name: string }[];
}
interface EntityHit {
  id: string;
  legalName: string;
  matchedAlias: string | null;
  country: string | null;
  role: "Customer" | "Partner" | "Both";
}
const NO_LINE = "__NO_LINE__";
interface SimilarIssueRow {
  id: string;
  number: number;
  type: IssueType;
  severity: string;
  status: string;
  ownerName: string | null;
  ownerTeam: string | null;
  ageDays: number;
}


/** Mirrors the server's resolveDecidingStage() (M17 AC3, M19 AC2-AC3) against the context's product lines, for the live proposal only. */
function clientDecidingStage(lines: ProductLine[], productId: string, scheme: string, country: string): Stage | null {
  if (productId) return lines.find((l) => l.id === productId)?.stage ?? null;
  const candidates = scheme && country ? lines.filter((l) => l.scheme === scheme && l.country === country) : lines;
  if (candidates.length === 0) return null;
  return candidates.reduce((best, l) => (STAGE_ORDER.indexOf(l.stage) > STAGE_ORDER.indexOf(best.stage) ? l : best)).stage;
}

type ReporterKind = "" | "CONTACT" | "SOMEONE_ELSE" | "FOUND_INTERNALLY";

interface FormState {
  type: IssueType | "";
  productId: string;
  /** "No specific product line": the scheme and country are chosen by hand. */
  noLine: boolean;
  /** Partner reports: the covered scheme and country picked ("UK_COP|GB"), or "OTHER" for the fallback fields. */
  coverageKey: string;
  scheme: Scheme | "";
  country: string;
  description: string;
  times: TimesFormState;
  reporterKind: ReporterKind;
  reporterContactId: string;
  reporterName: string;
  impact: IssueImpact | "";
  possibleBreach: boolean | null;
}

function emptyForm(viewerZone: string): FormState {
  return {
    type: "",
    productId: "",
    noLine: false,
    coverageKey: "",
    scheme: "",
    country: "",
    description: "",
    times: timesFormFrom(viewerZone),
    reporterKind: "",
    reporterContactId: "",
    reporterName: "",
    impact: "",
    possibleBreach: null,
  };
}

function buildReportBody(form: FormState, viewerZone: string) {
  const customerReporter =
    form.reporterKind === "CONTACT"
      ? { kind: "CONTACT" as const, contactId: form.reporterContactId }
      : form.reporterKind === "SOMEONE_ELSE"
        ? { kind: "SOMEONE_ELSE" as const, name: form.reporterName }
        : { kind: "FOUND_INTERNALLY" as const };
  return {
    productId: form.productId || null,
    scheme: form.scheme || null,
    country: form.country || null,
    type: form.type,
    description: form.description,
    ...timesBody(form.times, viewerZone),
    customerReporter,
    impact: form.impact,
    possibleBreach: form.possibleBreach,
  };
}

type Props = { viewerZone: string } & (
  | { mode: "entity"; entityId: string; entityName: string }
  | { mode: "group"; groupId: string; groupName: string; members: { id: string; legalName: string }[] }
  | { mode: "home" }
);

/**
 * One choice only: preselect it. A partner type reads the partner's coverages, any other type the entity's own product lines. Pure, applied when the
 * context arrives and when the type changes, never in an effect.
 */
function applyPreselect(f: FormState, ctx: IssueContext | null): FormState {
  if (!ctx) return f;
  if (f.type === "PARTNER_DEGRADED") {
    if (ctx.partnerCoverages.length === 1 && f.coverageKey === "" && !f.scheme) {
      const c = ctx.partnerCoverages[0];
      return { ...f, coverageKey: `${c.scheme}|${c.country}`, scheme: c.scheme, country: c.country };
    }
    return f;
  }
  if (ctx.customerRoleActive && ctx.productLines.length === 1 && !f.productId && !f.noLine) {
    const l = ctx.productLines[0];
    return { ...f, productId: l.id, scheme: l.scheme, country: l.country };
  }
  return f;
}

/** A partner type and any other type read different choices: switching between them starts the choice again. */
function changeType(f: FormState, type: IssueType, ctx: IssueContext | null): FormState {
  const kindChanged = (f.type === "PARTNER_DEGRADED") !== (type === "PARTNER_DEGRADED");
  const next: FormState = kindChanged ? { ...f, type, productId: "", noLine: false, coverageKey: "", scheme: "", country: "" } : { ...f, type };
  return applyPreselect(next, ctx);
}

/** The fields that depend on the affected entity: cleared when it changes, the rest of the form is kept. */
const DEPENDENT_FIELDS = { productId: "", noLine: false, coverageKey: "", scheme: "" as const, country: "", reporterKind: "" as const, reporterContactId: "", reporterName: "" };

export function ReportIssueDrawer(props: Props) {
  const router = useRouter();
  const { viewerZone } = props;
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => emptyForm(viewerZone));
  const [entityIds, setEntityIds] = React.useState<string[]>(props.mode === "entity" ? [props.entityId] : []);
  const [context, setContext] = React.useState<IssueContext | null>(null);
  const [similar, setSimilar] = React.useState<{ rows: SimilarIssueRow[]; loading: boolean; error: boolean }>({ rows: [], loading: false, error: false });
  const [addToExisting, setAddToExisting] = React.useState<SimilarIssueRow | null>(null);
  const [serverErrors, setErrors] = React.useState<Record<string, string[]>>({});
  // After a click on "Report issue" with fields missing, the missing fields show their errors and keep them up to date as they are fixed.
  const [attempted, setAttempted] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [contentBelow, setContentBelow] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  // From Home the entity is chosen in the drawer; from an entity page it is fixed.
  const [picked, setPicked] = React.useState<EntityHit | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const entityMode = props.mode === "entity" || props.mode === "home";
  const entityId = props.mode === "entity" ? props.entityId : props.mode === "home" ? (picked?.id ?? null) : null;
  const entityName = props.mode === "entity" ? props.entityName : props.mode === "home" ? (picked?.legalName ?? "") : "";
  const ready = props.mode !== "home" || !!picked;

  function pickEntity(hit: EntityHit | null) {
    setPicked(hit);
    setContext(null);
    setSimilar({ rows: [], loading: false, error: false });
    setAddToExisting(null);
    setForm((f) => ({ ...f, ...DEPENDENT_FIELDS })); // product line, scheme and country, reported at the customer by, the open issues box; the rest stays
  }

  function reset() {
    setForm(emptyForm(viewerZone));
    setPicked(null);
    setContext(null);
    setEntityIds(props.mode === "entity" ? [props.entityId] : []);
    setErrors({});
    setAttempted(false);
    setBanner(null);
    setAddToExisting(null);
  }

  React.useEffect(() => {
    if (!open || !entityMode || !entityId) return;
    let cancelled = false;
    void apiGet<IssueContext>(`/api/entities/${entityId}/issue-context`).then((res) => {
      if (!cancelled && res.ok) {
        setContext(res.data);
        setForm((f) => applyPreselect(f, res.data));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, entityMode, entityId]);

  React.useEffect(() => {
    if (!open || !entityMode || !entityId) return;
    const id = entityId;
    let cancelled = false;
    async function run() {
      setSimilar((s) => ({ ...s, loading: true, error: false }));
      const res = await apiRequest<SimilarIssueRow[]>(`/api/entities/${id}/issues/similar`, "POST", { scheme: form.scheme || null, country: form.country || null });
      if (cancelled) return;
      if (res.ok) setSimilar({ rows: res.data, loading: false, error: false });
      else setSimilar({ rows: [], loading: false, error: true });
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityId, form.scheme, form.country]);

  const isPartnerType = form.type === "PARTNER_DEGRADED";
  const lines = context?.productLines ?? [];
  const coverages = [...(context?.partnerCoverages ?? [])].sort((a, b) => `${SCHEME_LABELS[a.scheme]} ${a.country}`.localeCompare(`${SCHEME_LABELS[b.scheme]} ${b.country}`));
  const hasLines = !!context?.customerRoleActive && lines.length > 0;

  function selectProduct(productId: string) {
    if (productId === NO_LINE) {
      setForm((f) => ({ ...f, productId: "", noLine: true, scheme: "", country: "" }));
      return;
    }
    const line = lines.find((l) => l.id === productId);
    setForm((f) => ({ ...f, productId, noLine: false, scheme: line ? line.scheme : f.scheme, country: line ? line.country : f.country }));
  }
  /** "Change" next to a product line's read-only scheme and country: back to the list. */
  function changeProduct() {
    setForm((f) => ({ ...f, productId: "", noLine: false, scheme: "", country: "" }));
  }
  function selectCoverage(key: string) {
    if (key === "OTHER") {
      setForm((f) => ({ ...f, coverageKey: "OTHER", scheme: "", country: "" }));
      return;
    }
    const [scheme, country] = key.split("|");
    setForm((f) => ({ ...f, coverageKey: key, scheme: scheme as Scheme, country }));
  }

  // Until the coverage (partner type) or the product line is picked, the box cannot say whether there are open issues on it.
  const pickNeeded: "coverage" | "line" | null =
    isPartnerType && coverages.length > 0 && form.coverageKey === "" ? "coverage" : !isPartnerType && hasLines && !form.productId && !form.noLine ? "line" : null;
  const schemeRequired = form.type !== "" && TYPES_REQUIRING_SCHEME.includes(form.type);
  // Scheme and Country are shown when nothing resolves them: a partner's "Other scheme or country", "No specific product line", an entity with no product lines or coverages, or a group report.
  const showSchemeFields = isPartnerType ? coverages.length === 0 || form.coverageKey === "OTHER" : !hasLines || form.noLine;
  const lockedByLine = !isPartnerType && hasLines && !!form.productId;

  // "Suggested": the entity's own countries and schemes (from its product lines and partner coverages, then its registered country); all others A to Z.
  const ownSchemes = [...new Set([...lines.map((l) => l.scheme), ...coverages.map((c) => c.scheme)])];
  const ownCountries = [...new Set([...lines.map((l) => l.country), ...coverages.map((c) => c.country), ...(context?.registeredCountry ? [context.registeredCountry] : [])])];
  const schemeLabel = (sc: Scheme) => ({ value: sc, label: SCHEME_LABELS[sc] });
  const schemeSuggested: SuggestOption[] = ownSchemes.map(schemeLabel);
  const schemeOthers: SuggestOption[] = Object.values(Scheme).filter((sc) => !ownSchemes.includes(sc)).map(schemeLabel).sort((a, b) => a.label.localeCompare(b.label));
  const allCountries = (context?.countries ?? []).map((c) => ({ value: c.code, label: `${c.code}, ${c.name}` }));
  const countrySuggested: SuggestOption[] = ownCountries.map((code) => allCountries.find((c) => c.value === code)).filter((c): c is SuggestOption => !!c);
  const countryOthers: SuggestOption[] = allCountries.filter((c) => !ownCountries.includes(c.value)).sort((a, b) => a.label.localeCompare(b.label));

  const decidingStage = context ? clientDecidingStage(context.productLines, form.productId, form.scheme, form.country) : null;
  const proposal =
    form.type && form.impact && form.possibleBreach !== null
      ? proposeSeverity({
          impact: form.impact,
          possibleBreach: form.possibleBreach,
          type: form.type,
          decidingStage,
          customerRole: entityMode ? (context?.customerRoleActive ?? false) : false,
          scheme: form.scheme || undefined,
          country: form.country || undefined,
        })
      : null;

  async function submit() {
    if (missing.length > 0) {
      // Fields are missing: show every error and go to the first one; nothing is sent.
      setAttempted(true);
      setTimeout(showFirstMissing, 0);
      return;
    }
    setPending(true);
    setErrors({});
    setBanner(null);
    try {
      if (entityMode) {
        if (!entityId) return;
        const res = await apiRequest<{ id: string; displayId: string }>(`/api/entities/${entityId}/issues`, "POST", buildReportBody(form, viewerZone));
        if (!res.ok) {
          if (res.kind === "validation") setErrors(res.fieldErrors);
          else setBanner("Issue not reported. Try again.");
          return;
        }
        setOpen(false);
        router.push(`/issues/${res.data.id}?reported=1`);
      } else {
        if (entityIds.length === 0) {
          setErrors({ entityIds: ["Select at least one affected entity"] });
          return;
        }
        const res = await apiRequest<{ id: string }[]>(`/api/groups/${props.groupId}/issues`, "POST", { entityIds, report: buildReportBody(form, viewerZone) });
        if (!res.ok) {
          if (res.kind === "validation") setErrors(res.fieldErrors);
          else setBanner("Issue not reported. Try again.");
          return;
        }
        setOpen(false);
        toast.success(`${res.data.length} issue${res.data.length === 1 ? "" : "s"} reported`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function confirmAddToExisting() {
    if (!addToExisting || !entityMode) return;
    setPending(true);
    try {
      const res = await apiRequest<{ id: string; displayId: string }>(`/api/issues/${addToExisting.id}/reports`, "POST", buildReportBody(form, viewerZone));
      if (!res.ok) {
        if (res.kind === "validation") {
          setErrors(res.fieldErrors);
          setAddToExisting(null);
        } else {
          toast.error("Your report wasn't added. Try again.");
        }
        return;
      }
      setOpen(false);
      toast.success(`Your report was added to ${res.data.displayId}`);
      router.push(`/issues/${res.data.id}`);
    } finally {
      setPending(false);
    }
  }

  const timesOk = timesValid(form.times, viewerZone);

  const requiredFieldsValid =
    form.type !== "" &&
    (!schemeRequired || (form.scheme !== "" && form.country !== "")) &&
    ((form.scheme === "") === (form.country === "")) &&
    form.description.trim().length >= 20 &&
    form.description.length <= 5000 &&
    form.reporterKind !== "" &&
    (form.reporterKind !== "CONTACT" || form.reporterContactId !== "") &&
    (form.reporterKind !== "SOMEONE_ELSE" || form.reporterName.trim().length > 0) &&
    form.impact !== "" &&
    form.possibleBreach !== null &&
    timesOk;



  /** Every missing or invalid field, in the order of the drawer: what the "Report issue" button checks, the same rules as `requiredFieldsValid`. */
  const missing: { key: string; message: string; target: string }[] = [];
  if (props.mode === "home" && !entityId) missing.push({ key: "entityId", message: "Select the affected entity", target: "report-issue-entity" });
  if (props.mode === "group" && entityIds.length === 0) missing.push({ key: "entityIds", message: "Select at least one affected entity", target: "report-issue-entities" });
  if (form.type === "") missing.push({ key: "type", message: "Choose the issue type", target: "report-issue-type" });
  if (isPartnerType && coverages.length > 0 && form.coverageKey === "") missing.push({ key: "scheme", message: "Select the partner coverage affected", target: "report-issue-coverage" });
  else if ((schemeRequired && (form.scheme === "" || form.country === "")) || (form.scheme === "") !== (form.country === ""))
    missing.push({ key: "scheme", message: schemeRequired ? "Select the scheme and the country" : "Enter both the scheme and the country, or neither", target: form.scheme === "" ? "report-issue-scheme" : "report-issue-country" });
  if (form.description.trim().length < 20) missing.push({ key: "description", message: "Describe the issue in at least 20 characters", target: "report-issue-description" });
  if (!timesOk) missing.push({ key: "times", message: "Check the times", target: "report-times-aware-date" });
  if (form.reporterKind === "" || (form.reporterKind === "CONTACT" && form.reporterContactId === "")) missing.push({ key: "customerReporter", message: "Choose who reported it", target: props.mode === "group" ? "report-issue-reporter-group" : "report-issue-reporter" });
  else if (form.reporterKind === "SOMEONE_ELSE" && form.reporterName.trim().length === 0) missing.push({ key: "reporterName", message: "Enter the name of the person", target: "report-issue-reporter-name" });
  if (form.impact === "") missing.push({ key: "impact", message: "Select the impact", target: "report-issue-impact" });
  if (form.possibleBreach === null) missing.push({ key: "possibleBreach", message: "Select Yes or No", target: "report-issue-breach" });
  const clientErrors: Record<string, string[]> = attempted ? Object.fromEntries(missing.filter((m) => m.key !== "times").map((m) => [m.key, [m.message]])) : {};
  const errors: Record<string, string[]> = { ...serverErrors, ...clientErrors };

  /** Scroll the first invalid field into view and move focus to it. */
  function showFirstMissing() {
    const first = missing[0];
    if (!first) return;
    const el = document.getElementById(first.target);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const focusable = el.matches("input, button, select, textarea, [tabindex]") ? el : el.querySelector<HTMLElement>("input, button, [role=combobox], textarea");
    focusable?.focus({ preventScroll: true });
  }

  function trackScroll() {
    const el = bodyRef.current;
    if (el) setContentBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
        else setTimeout(() => triggerRef.current?.focus(), 0); // Escape or Cancel: focus goes back to the button that opened the drawer
      }}
    >
      <Button ref={triggerRef} variant="secondary" onClick={() => setOpen(true)} aria-label={props.mode === "home" ? "Report issue" : undefined}>
        Report issue
      </Button>
      <DrawerContent width={640}>
        <DialogHeader>Report issue</DialogHeader>
        <DialogBody ref={bodyRef} onScroll={trackScroll} className="min-h-0 flex-1 overflow-y-auto pb-6">
          {banner && <div className="rounded-md border-l-4 border-l-danger bg-tint p-3 text-body text-danger">{banner}</div>}

          {props.mode === "entity" ? (
            <div className="flex flex-col gap-1">
              <span className="text-meta text-text-secondary">Affected entity</span>
              <span className="text-body">{props.entityName}</span>
            </div>
          ) : props.mode === "home" ? (
            <EntityPicker picked={picked} onPick={pickEntity} error={errors.entityId?.[0]} />
          ) : props.mode === "group" ? (
            <div id="report-issue-entities" className="flex flex-col gap-1.5">
              <span className="text-meta text-text-secondary">Affected entities *</span>
              {props.members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-body">
                  <Checkbox
                    checked={entityIds.includes(m.id)}
                    onChange={(e) => setEntityIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id)))}
                  />
                  {m.legalName}
                </label>
              ))}
              {errors.entityIds && <FieldError id="report-issue-entities-error">{errors.entityIds[0]}</FieldError>}
            </div>
          ) : null}

          {ready && (
            <>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-issue-type" className="text-meta text-text-secondary">Type *</label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => changeType(f, v as IssueType, context))}>
              <SelectTrigger id="report-issue-type" aria-invalid={!!errors.type} aria-describedby={errors.type ? "report-issue-type-error" : undefined}>
                <SelectValue placeholder="Select the issue type" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ISSUE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <FieldError id="report-issue-type-error">{errors.type[0]}</FieldError>}
          </div>

          {entityMode && isPartnerType && coverages.length > 0 && (
            <div id="report-issue-coverage" className="flex flex-col gap-1.5" role="radiogroup" aria-label="Partner coverage affected" aria-invalid={!!errors.scheme && form.coverageKey === ""} aria-describedby={errors.scheme && form.coverageKey === "" ? "report-issue-scheme-error" : undefined}>
              <span className="text-meta text-text-secondary">Partner coverage affected *</span>
              {coverages.map((c) => {
                const key = `${c.scheme}|${c.country}`;
                return (
                  <label key={key} className="flex items-center gap-2 rounded-md border border-border p-2 text-body">
                    <input type="radio" name="report-issue-coverage" checked={form.coverageKey === key} onChange={() => selectCoverage(key)} className="size-4 accent-primary" />
                    {SCHEME_LABELS[c.scheme]} / {c.country}
                    <Badge variant="neutral-outline">{COVERAGE_STATUS_LABELS[c.status as keyof typeof COVERAGE_STATUS_LABELS] ?? c.status}</Badge>
                  </label>
                );
              })}
              {form.coverageKey === "OTHER" ? (
                <button type="button" onClick={() => setForm((f) => ({ ...f, coverageKey: "", scheme: "", country: "" }))} className="self-start text-meta text-link-text hover:underline">
                  Choose from the partner&apos;s coverage
                </button>
              ) : (
                <button type="button" onClick={() => selectCoverage("OTHER")} className="self-start text-meta text-link-text hover:underline">
                  Other scheme or country
                </button>
              )}
            </div>
          )}

          {entityMode && !isPartnerType && hasLines && (
            <div className="flex flex-col gap-1">
              <label htmlFor="report-issue-product" className="text-meta text-text-secondary">Product line</label>
              {lockedByLine ? (
                <div className="flex items-center gap-2">
                  <span data-testid="product-line-summary" className="text-body">{lines.find((l) => l.id === form.productId)?.label}</span>
                  <button type="button" onClick={changeProduct} className="text-meta text-link-text hover:underline">
                    Change
                  </button>
                </div>
              ) : (
                <Select value={form.noLine ? NO_LINE : form.productId} onValueChange={selectProduct}>
                  <SelectTrigger id="report-issue-product">
                    <SelectValue placeholder="Select a product line" />
                  </SelectTrigger>
                  <SelectContent sideOffset={30}>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={NO_LINE}>No specific product line</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {form.noLine && <span className="text-meta text-text-secondary">For issues not tied to one product, for example billing</span>}
              {!form.noLine && !lockedByLine && <span className="text-meta text-text-secondary">No specific product line: for issues not tied to one product, for example billing</span>}
            </div>
          )}

          {(showSchemeFields || lockedByLine) && !(isPartnerType && coverages.length > 0 && form.coverageKey !== "OTHER") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="report-issue-scheme" className="text-meta text-text-secondary">Scheme{schemeRequired ? " *" : ""}</label>
                {lockedByLine ? (
                  <Input id="report-issue-scheme" value={form.scheme ? SCHEME_LABELS[form.scheme] : ""} readOnly aria-label="Scheme" />
                ) : (
                  <SuggestCombobox id="report-issue-scheme" label="Scheme" value={form.scheme} onChange={(v) => setForm((f) => ({ ...f, scheme: v as Scheme }))} suggested={schemeSuggested} others={schemeOthers} invalid={!!errors.scheme} />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="report-issue-country" className="text-meta text-text-secondary">Country{schemeRequired ? " *" : ""}</label>
                {lockedByLine ? (
                  <Input id="report-issue-country" value={allCountries.find((c) => c.value === form.country)?.label ?? form.country} readOnly aria-label="Country" />
                ) : context?.countries ? (
                  <SuggestCombobox id="report-issue-country" label="Country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} suggested={countrySuggested} others={countryOthers} />
                ) : (
                  <Input id="report-issue-country" aria-label="Country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase().slice(0, 2) }))} />
                )}
              </div>
            </div>
          )}
          {errors.scheme && <FieldError id="report-issue-scheme-error">{errors.scheme[0]}</FieldError>}

          {entityMode && entityId && (
            <div className="rounded-md border border-border border-l-4 border-l-due bg-white p-3">
              <p className="mb-1.5 text-meta font-medium text-text-secondary">
                Open issues on {entityName}{form.scheme ? `, ${SCHEME_LABELS[form.scheme]} ${form.country}` : ""}
              </p>
              {pickNeeded ? (
                <p data-testid="open-issues-pick" className="text-meta text-text-secondary">
                  {pickNeeded === "coverage" ? "Pick a coverage to check for open issues on it" : "Pick a product line to check for open issues on it"}
                </p>
              ) : similar.loading ? (
                <div className="flex flex-col gap-1.5">
                  <div className="h-5 w-full animate-pulse rounded bg-tint" />
                  <div className="h-5 w-full animate-pulse rounded bg-tint" />
                </div>
              ) : similar.error ? (
                <FieldError>Couldn&apos;t check for open issues. Retry</FieldError>
              ) : similar.rows.length === 0 ? (
                <p className="text-meta text-text-secondary">No open issues on this entity for this scheme and country</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {similar.rows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-meta first:border-t-0 first:pt-0">
                      <span className="font-mono">{issueDisplayId(row.number)}</span>
                      <span>{ISSUE_TYPE_LABELS[row.type]}</span>
                      <Badge variant="neutral-outline">{SEVERITY_LABELS[row.severity as keyof typeof SEVERITY_LABELS]}</Badge>
                      <Badge variant="neutral-outline">{ISSUE_STATUS_LABELS[row.status as keyof typeof ISSUE_STATUS_LABELS]}</Badge>
                      <span>{row.ownerName ? `${row.ownerName} (${TEAM_LABELS[row.ownerTeam as keyof typeof TEAM_LABELS]})` : "No owner"}</span>
                      <span>{row.ageDays} day{row.ageDays === 1 ? "" : "s"}</span>
                      <span className="flex-1" />
                      <Button variant="text" size="md" disabled={!requiredFieldsValid} onClick={() => setAddToExisting(row)}>
                        Add to existing issue
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="report-issue-description" className="text-meta text-text-secondary">Description *</label>
            <Textarea
              id="report-issue-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={5000}
              rows={4}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "report-issue-description-error" : undefined}
            />
            <span className="self-end text-meta text-text-secondary">{form.description.length} / 5,000</span>
            {errors.description && <FieldError id="report-issue-description-error">{errors.description[0]}</FieldError>}
          </div>

          <TimesFields form={form.times} onChange={(times) => setForm((f) => ({ ...f, times }))} zone={viewerZone} serverErrors={serverErrors} idPrefix="report-times" />

          {entityMode && (
            <div className="flex flex-col gap-1">
              <label htmlFor="report-issue-reporter" className="text-meta text-text-secondary">Reported at the customer by *</label>
              <Select
                value={form.reporterKind === "CONTACT" ? `CONTACT:${form.reporterContactId}` : form.reporterKind}
                onValueChange={(v) =>
                  setForm((f) =>
                    v.startsWith("CONTACT:")
                      ? { ...f, reporterKind: "CONTACT", reporterContactId: v.slice("CONTACT:".length), reporterName: "" }
                      : { ...f, reporterKind: v as ReporterKind, reporterContactId: "", reporterName: "" },
                  )
                }
              >
                <SelectTrigger id="report-issue-reporter" aria-invalid={!!errors.customerReporter} aria-describedby={errors.customerReporter ? "report-issue-reporter-error" : undefined}>
                  <SelectValue placeholder="Select who reported it" />
                </SelectTrigger>
                <SelectContent>
                  {context?.contacts.map((c) => (
                    <SelectItem key={c.id} value={`CONTACT:${c.id}`}>
                      {c.fullName}
                      {c.role === "INCIDENT" ? " (Incident contact)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="SOMEONE_ELSE">Someone else</SelectItem>
                  <SelectItem value="FOUND_INTERNALLY">Found by Corvane</SelectItem>
                </SelectContent>
              </Select>
              {errors.customerReporter && <FieldError id="report-issue-reporter-error">{errors.customerReporter[0]}</FieldError>}
            </div>
          )}

          {props.mode === "group" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="report-issue-reporter-group" className="text-meta text-text-secondary">Reported at the customer by *</label>
              <Select value={form.reporterKind} onValueChange={(v) => setForm((f) => ({ ...f, reporterKind: v as ReporterKind }))}>
                <SelectTrigger id="report-issue-reporter-group" aria-invalid={!!errors.customerReporter} aria-describedby={errors.customerReporter ? "report-issue-reporter-group-error" : undefined}>
                  <SelectValue placeholder="Select who reported it" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOMEONE_ELSE">Someone else</SelectItem>
                  <SelectItem value="FOUND_INTERNALLY">Found by Corvane</SelectItem>
                </SelectContent>
              </Select>
              {errors.customerReporter && <FieldError id="report-issue-reporter-group-error">{errors.customerReporter[0]}</FieldError>}
            </div>
          )}
          {form.reporterKind === "SOMEONE_ELSE" && (
            <div className="flex flex-col gap-1">
              <Input
                id="report-issue-reporter-name"
                aria-label="Name of the person"
                aria-required="true"
                aria-invalid={!!errors.reporterName}
                aria-describedby={errors.reporterName ? "report-issue-reporter-name-error" : undefined}
                placeholder="Name *"
                value={form.reporterName}
                onChange={(e) => setForm((f) => ({ ...f, reporterName: e.target.value.slice(0, 120) }))}
              />
              {errors.reporterName && <FieldError id="report-issue-reporter-name-error">{errors.reporterName[0]}</FieldError>}
            </div>
          )}

          <div id="report-issue-impact" className="flex flex-col gap-1.5" role="radiogroup" aria-label="Impact" aria-invalid={!!errors.impact} aria-describedby={errors.impact ? "report-issue-impact-error" : undefined}>
            <span className="text-meta text-text-secondary">Impact *</span>
            <div className="grid grid-cols-2 gap-2">
              {IMPACTS.map((i) => (
                <label key={i} className="flex items-center gap-1.5 rounded-md border border-border p-2 text-body">
                  <input type="radio" name="report-issue-impact" checked={form.impact === i} onChange={() => setForm((f) => ({ ...f, impact: i }))} className="size-4 accent-primary" />
                  {ISSUE_IMPACT_LABELS[i]}
                </label>
              ))}
            </div>
            {errors.impact && <FieldError id="report-issue-impact-error">{errors.impact[0]}</FieldError>}
          </div>

          <div id="report-issue-breach" className="flex flex-col gap-1.5" role="radiogroup" aria-label="Possible data breach" aria-invalid={!!errors.possibleBreach} aria-describedby={errors.possibleBreach ? "report-issue-breach-error" : undefined}>
            <span className="text-meta text-text-secondary">Possible data breach *</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-body">
                <input type="radio" name="report-issue-breach" checked={form.possibleBreach === true} onChange={() => setForm((f) => ({ ...f, possibleBreach: true }))} className="size-4 accent-primary" />
                Yes
              </label>
              <label className="flex items-center gap-1.5 text-body">
                <input type="radio" name="report-issue-breach" checked={form.possibleBreach === false} onChange={() => setForm((f) => ({ ...f, possibleBreach: false }))} className="size-4 accent-primary" />
                No
              </label>
            </div>
            {errors.possibleBreach && <FieldError id="report-issue-breach-error">{errors.possibleBreach[0]}</FieldError>}
          </div>

          {proposal && (
            <p className="text-body font-medium">
              Proposed severity: <Badge variant="neutral-outline">{SEVERITY_LABELS[proposal.severity]} ({proposal.rule})</Badge>
            </p>
          )}
          {proposal?.capLabel && <p className="text-meta text-due">{proposal.capLabel}</p>}
            </>
          )}
        </DialogBody>
        {/* The button stays enabled: with fields missing, a click shows every error and goes to the first one. The footer's top border shows while content scrolls under it. */}
        <DialogFooter className={contentBelow ? "border-border" : "border-transparent"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => void submit()}>
            Report issue
          </Button>
        </DialogFooter>
      </DrawerContent>

      {addToExisting && (
        <Dialog open onOpenChange={(next) => !next && setAddToExisting(null)}>
          <DialogContent>
            <DialogHeader>Add to existing issue</DialogHeader>
            <DialogBody>
              <p className="text-body">
                Add your report to {issueDisplayId(addToExisting.number)}? No new issue will be created.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setAddToExisting(null)} disabled={pending}>
                Cancel
              </Button>
              <Button loading={pending} onClick={() => void confirmAddToExisting()}>
                Add to existing issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}


/**
 * "Affected entity *" when the drawer opens from Home: a search box (name, alias, LEI or BIC: the same search as the top bar). Results show the name,
 * a role tag (Customer, Partner or Both) and the country. Once picked, the name stays with a "Change" link.
 */
function EntityPicker({ picked, onPick, error }: { picked: EntityHit | null; onPick: (hit: EntityHit | null) => void; error?: string }) {
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<{ q: string; hits: EntityHit[] }>({ q: "", hits: [] });
  const [active, setActive] = React.useState(0);
  const q = query.trim();
  const hits = q.length >= 2 && result.q === q ? result.hits : [];
  const loading = q.length >= 2 && result.q !== q;

  React.useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void apiGet<EntityHit[]>(`/api/entities/search?q=${encodeURIComponent(q)}`).then((res) => {
        if (cancelled) return;
        setResult({ q, hits: res.ok ? res.data : [] });
        setActive(0);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  if (picked) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-meta text-text-secondary">Affected entity *</span>
        <div className="flex items-center gap-2">
          <span data-testid="picked-entity" className="text-body font-semibold">{picked.legalName}</span>
          <button
            type="button"
            onClick={() => {
              onPick(null);
              setQuery("");
            }}
            className="text-meta text-link-text hover:underline"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="report-issue-entity" className="text-meta text-text-secondary">Affected entity *</label>
      <input
        id="report-issue-entity"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls="report-issue-entity-results"
        aria-autocomplete="list"
        autoFocus
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            onPick(hits[active]);
          }
        }}
        placeholder="Search by name, alias, LEI or BIC"
        className="h-9 w-full rounded-sm border border-border-strong bg-white px-3 text-body outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
      />
      {q.length >= 2 && !loading && hits.length === 0 && <p className="text-meta text-text-secondary">No entity matches. Try the name, an alias, the LEI or a BIC</p>}
      {hits.length > 0 && (
        <div id="report-issue-entity-results" role="listbox" aria-label="Affected entity results" className="flex flex-col rounded-sm border border-border bg-white">
          {hits.map((h, i) => (
            <div
              key={h.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(h)}
              className={`flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-body first:border-t-0 ${i === active ? "bg-tint-strong" : ""}`}
            >
              <span className="flex-1">
                {h.legalName}
                {h.matchedAlias && <span className="text-meta text-text-secondary"> ({h.matchedAlias})</span>}
              </span>
              <Badge variant="neutral-outline">{h.role}</Badge>
              <span className="text-meta text-text-secondary">{h.country ?? ""}</span>
            </div>
          ))}
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
