"use client";

import { Plus } from "lucide-react";
import { Currency, Scheme } from "@prisma/client";

import { today } from "@/lib/dates";
import { SCHEME_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors, ProductsState } from "@/components/customer-wizard/types";
import { FieldError } from "@/components/ui/field-error";

const SCHEME_BADGE_VARIANT: Record<Scheme, "scheme-eu" | "scheme-uk" | "neutral-outline"> = {
  EU_VOP: "scheme-eu",
  UK_COP: "scheme-uk",
  GLOBAL_VALIDATION: "neutral-outline",
};

function emptyLine() {
  return { product: "" as const, country: "", contractingEntityId: "", targetGoLive: "" };
}

export function Step2Products({
  products,
  setProducts,
  countries,
  contractingEntityOptions,
  errors,
}: {
  products: ProductsState;
  setProducts: (updater: (prev: ProductsState) => ProductsState) => void;
  countries: { code: string; name: string }[];
  contractingEntityOptions: { id: string; legalName: string }[];
  errors: FieldErrors;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Product lines</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-border text-left text-meta text-text-secondary">
                <th className="py-2">Product or scheme</th>
                <th className="py-2">Country</th>
                <th className="py-2">Contracting entity</th>
                <th className="py-2">Target go-live</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {products.productLines.map((line, i) => (
                <tr key={i} className="border-b border-border align-top">
                  <td className="py-2 pr-2">
                    <Select
                      value={line.product}
                      onValueChange={(v) =>
                        setProducts((prev) => ({
                          ...prev,
                          productLines: prev.productLines.map((l, j) => (j === i ? { ...l, product: v as Scheme } : l)),
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Product or scheme">
                        {line.product ? <Badge variant={SCHEME_BADGE_VARIANT[line.product]}>{SCHEME_LABELS[line.product]}</Badge> : <SelectValue placeholder="Select" />}
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(Scheme).map((s) => (
                          <SelectItem key={s} value={s}>
                            {SCHEME_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`productLines.${i}.product`] && <FieldError>{errors[`productLines.${i}.product`][0]}</FieldError>}
                  </td>
                  <td className="py-2 pr-2">
                    <Select
                      value={line.country}
                      onValueChange={(v) =>
                        setProducts((prev) => ({ ...prev, productLines: prev.productLines.map((l, j) => (j === i ? { ...l, country: v } : l)) }))
                      }
                    >
                      <SelectTrigger aria-label="Country">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`productLines.${i}.country`] && <FieldError>{errors[`productLines.${i}.country`][0]}</FieldError>}
                  </td>
                  <td className="py-2 pr-2">
                    <Select
                      value={line.contractingEntityId}
                      onValueChange={(v) =>
                        setProducts((prev) => ({
                          ...prev,
                          productLines: prev.productLines.map((l, j) => (j === i ? { ...l, contractingEntityId: v } : l)),
                        }))
                      }
                    >
                      <SelectTrigger aria-label="Contracting entity">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractingEntityOptions.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.legalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="date"
                      aria-label="Target go-live"
                      min={today()}
                      value={line.targetGoLive}
                      onChange={(e) =>
                        setProducts((prev) => ({
                          ...prev,
                          productLines: prev.productLines.map((l, j) => (j === i ? { ...l, targetGoLive: e.target.value } : l)),
                        }))
                      }
                    />
                    {line.targetGoLive && line.targetGoLive < today() ? (
                      <FieldError>Target go-live is in the past</FieldError>
                    ) : (
                      errors[`productLines.${i}.targetGoLive`] && <FieldError>{errors[`productLines.${i}.targetGoLive`][0]}</FieldError>
                    )}
                  </td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => setProducts((prev) => ({ ...prev, productLines: prev.productLines.filter((_, j) => j !== i) }))}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.productLines && <FieldError>{errors.productLines[0]}</FieldError>}
        <div>
          <Button type="button" variant="secondary" onClick={() => setProducts((prev) => ({ ...prev, productLines: [...prev.productLines, emptyLine()] }))}>
            <Plus className="size-4" aria-hidden="true" /> Add product line
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commercial terms</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-meta text-text-secondary">Currency *</label>
            <div className="flex overflow-hidden rounded-sm border border-border-strong">
              {Object.values(Currency).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setProducts((prev) => ({ ...prev, currency: c }))}
                  className={`h-9 flex-1 text-body ${products.currency === c ? "bg-selected font-medium text-primary" : "bg-white text-text-secondary"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wz-price" className="text-meta text-text-secondary">Price per verification *</label>
            <Input
              id="wz-price"
              type="number"
              step="0.0001"
              className="text-right"
              value={products.pricePerVerification}
              onChange={(e) => setProducts((prev) => ({ ...prev, pricePerVerification: e.target.value === "" ? "" : Number(e.target.value) }))}
              aria-invalid={!!errors["commercialTerms.pricePerVerification"]}
            />
            {errors["commercialTerms.pricePerVerification"] && <FieldError>{errors["commercialTerms.pricePerVerification"][0]}</FieldError>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-meta text-text-secondary">Volume tiers</span>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-meta text-text-secondary">
                  <th className="py-2">From</th>
                  <th className="py-2">To</th>
                  <th className="py-2">Price</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {products.volumeTiers.map((tier, i) => (
                  <tr key={i} className="border-b border-border align-top">
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        aria-label="From volume"
                        value={tier.fromVolume}
                        onChange={(e) =>
                          setProducts((prev) => ({
                            ...prev,
                            volumeTiers: prev.volumeTiers.map((t, j) => (j === i ? { ...t, fromVolume: Number(e.target.value) } : t)),
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        aria-label="To volume"
                        placeholder="No upper limit"
                        value={tier.toVolume ?? ""}
                        onChange={(e) =>
                          setProducts((prev) => ({
                            ...prev,
                            volumeTiers: prev.volumeTiers.map((t, j) => (j === i ? { ...t, toVolume: e.target.value === "" ? null : Number(e.target.value) } : t)),
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        step="0.0001"
                        aria-label="Tier price"
                        value={tier.pricePerVerification}
                        onChange={(e) =>
                          setProducts((prev) => ({
                            ...prev,
                            volumeTiers: prev.volumeTiers.map((t, j) => (j === i ? { ...t, pricePerVerification: e.target.value === "" ? "" : Number(e.target.value) } : t)),
                          }))
                        }
                      />
                    </td>
                    <td className="py-2">
                      <Button type="button" variant="text" onClick={() => setProducts((prev) => ({ ...prev, volumeTiers: prev.volumeTiers.filter((_, j) => j !== i) }))}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.volumeTiers && <FieldError>{errors.volumeTiers[0]}</FieldError>}
          <div>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setProducts((prev) => ({ ...prev, volumeTiers: [...prev.volumeTiers, { fromVolume: 0, toVolume: null, pricePerVerification: "" }] }))
              }
            >
              <Plus className="size-4" aria-hidden="true" /> Add tier
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="wz-min" className="text-meta text-text-secondary">Monthly minimum</label>
            <Input
              id="wz-min"
              type="number"
              value={products.monthlyMinimum}
              onChange={(e) => setProducts((prev) => ({ ...prev, monthlyMinimum: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            {errors["commercialTerms.monthlyMinimum"] && <FieldError>{errors["commercialTerms.monthlyMinimum"][0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wz-pay-term" className="text-meta text-text-secondary">Payment term (days)</label>
            <Input
              id="wz-pay-term"
              type="number"
              value={products.paymentTermDays}
              onChange={(e) => setProducts((prev) => ({ ...prev, paymentTermDays: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            {errors["commercialTerms.paymentTermDays"] && <FieldError>{errors["commercialTerms.paymentTermDays"][0]}</FieldError>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promised SLAs</CardTitle>
          <Badge variant="neutral-outline">Optional</Badge>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="wz-avail" className="text-meta text-text-secondary">Availability %</label>
            <Input
              id="wz-avail"
              type="number"
              step="0.01"
              value={products.availabilityPct}
              onChange={(e) => setProducts((prev) => ({ ...prev, availabilityPct: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wz-resp" className="text-meta text-text-secondary">Maximum response time (ms)</label>
            <Input
              id="wz-resp"
              type="number"
              value={products.maxResponseMs}
              onChange={(e) => setProducts((prev) => ({ ...prev, maxResponseMs: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="wz-sla-other" className="text-meta text-text-secondary">Other SLA commitments</label>
          <Textarea id="wz-sla-other" value={products.slaOther} onChange={(e) => setProducts((prev) => ({ ...prev, slaOther: e.target.value }))} className="min-h-[72px]" maxLength={1000} />
          <div className="flex justify-end">
            <span className="text-meta text-text-secondary">{products.slaOther.length} / 1,000</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Special terms</CardTitle>
          <Badge variant="neutral-outline">Optional</Badge>
        </CardHeader>
        <div className="flex flex-col gap-1">
          <label htmlFor="wz-special" className="text-meta text-text-secondary">Special terms</label>
          <Textarea
            id="wz-special"
            value={products.specialTerms}
            onChange={(e) => setProducts((prev) => ({ ...prev, specialTerms: e.target.value }))}
            className="min-h-[88px]"
            maxLength={2000}
            placeholder="Pilot pricing for first 3 months in DE"
          />
          <div className="flex justify-end">
            <span className="text-meta text-text-secondary">{products.specialTerms.length} / 2,000</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
