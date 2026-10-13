import { notFound } from "next/navigation";
import { Check, OctagonAlert } from "lucide-react";
import { Stage, Team } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { ChangeStageDialog } from "@/components/entity/products/ChangeStageDialog";
import { MarkAsBlockedDialog } from "@/components/entity/products/MarkAsBlockedDialog";
import { ResolveBlockDialog } from "@/components/entity/products/ResolveBlockDialog";
import { daysBetween, formatDate, toLocalDate, today } from "@/lib/dates";
import { BLOCKED_BY_LABELS, ownedByLabel, SCHEME_LABELS, STAGE_LABELS, STAGE_ORDER, STAGE_SHORT_LABELS } from "@/lib/labels";
import { can } from "@/server/permissions/can";
import { loadProductsData, type ProductsData } from "@/server/queries/products";
import { getCurrentUser } from "@/server/session";

type Product = ProductsData["products"][number];

const LIVE_OR_LATER: Stage[] = [Stage.LIVE_HYPERCARE, Stage.RAMP_UP, Stage.BAU];

function schemeVariant(product: Product["product"]) {
  return product === "EU_VOP" ? "scheme-eu" : product === "UK_COP" ? "scheme-uk" : "neutral-outline";
}

function StageTrack({ product }: { product: Product }) {
  const currentIndex = STAGE_ORDER.indexOf(product.stage);
  const isBlocked = product.blockedBy !== null;
  return (
    <div className="flex flex-wrap gap-1">
      {STAGE_ORDER.map((stage, i) => {
        const isSkipped = product.skippedStages.includes(stage);
        const isCurrent = i === currentIndex;
        const isCompleted = i < currentIndex && !isSkipped;
        let classes = "border border-neutral-300 bg-white text-text-secondary";
        let label: string = STAGE_SHORT_LABELS[stage];
        if (isSkipped) {
          classes = "border border-dashed border-neutral-300 bg-tint text-text-secondary";
          label = "Skipped";
        } else if (isCurrent && isBlocked) {
          classes = "border-2 border-danger bg-white text-danger";
        } else if (isCurrent) {
          classes = "border-transparent bg-primary text-white";
        } else if (isCompleted) {
          classes = "border-transparent bg-tint-strong text-primary";
        }
        return (
          <span
            key={stage}
            title={STAGE_LABELS[stage]}
            className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-chip font-medium ${classes}`}
          >
            {isCurrent && isBlocked && <OctagonAlert className="size-3" aria-hidden="true" />}
            {isCompleted && <Check className="size-3" aria-hidden="true" />}
            {label}
          </span>
        );
      })}
    </div>
  );
}

function ProductBand({ data, product, canEdit }: { data: ProductsData; product: Product; canEdit: boolean }) {
  const isOverdue = toLocalDate(product.targetGoLive) < today() && !LIVE_OR_LATER.includes(product.stage);
  const daysInStage = daysBetween(toLocalDate(product.stageEnteredAt), today());
  const isLastStage = STAGE_ORDER.indexOf(product.stage) === STAGE_ORDER.length - 1;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={schemeVariant(product.product)}>{SCHEME_LABELS[product.product]}</Badge>
        <span className="text-body font-medium">{product.country}</span>
        {product.contractingEntityId !== data.entity.id && (
          <span className="text-meta text-text-secondary">Contracting entity: {product.contractingEntity.legalName}</span>
        )}
        <span className="flex-1" />
        {canEdit && (
          <div className="flex gap-2">
            {!isLastStage && (
              <ChangeStageDialog
                productId={product.id}
                version={product.version}
                scheme={product.product}
                country={product.country}
                currentStage={product.stage}
                stageEnteredAt={toLocalDate(product.stageEnteredAt)}
                openBlock={
                  product.blockedBy
                    ? { blockedBy: product.blockedBy, blockedSince: toLocalDate(product.blockedSince!), reason: product.blockedReason ?? "" }
                    : null
                }
              />
            )}
            {product.blockedBy ? (
              <ResolveBlockDialog
                productId={product.id}
                version={product.version}
                scheme={product.product}
                country={product.country}
                blockedBy={product.blockedBy}
                blockedSince={toLocalDate(product.blockedSince!)}
              />
            ) : (
              <MarkAsBlockedDialog productId={product.id} version={product.version} scheme={product.product} country={product.country} />
            )}
          </div>
        )}
      </div>
      <div className="mt-3">
        <StageTrack product={product} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-text-secondary">
        <span>Current stage: <span className="font-medium text-text">{STAGE_LABELS[product.stage]}</span></span>
        <span>Entered {formatDate(toLocalDate(product.stageEnteredAt))}</span>
        <span>{daysInStage} day{daysInStage === 1 ? "" : "s"} in stage</span>
        <span>Target go-live {formatDate(toLocalDate(product.targetGoLive))}</span>
        <span className="flex-1" />
        {isOverdue && (
          <Badge variant="danger">Go-live overdue by {daysBetween(toLocalDate(product.targetGoLive), today())} days</Badge>
        )}
        {product.billableFrom && <Badge variant="success">Billable from {formatDate(toLocalDate(product.billableFrom))}</Badge>}
      </div>
      {product.blockedBy && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-danger bg-white px-3 py-2 text-body text-danger">
          <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Blocked by {BLOCKED_BY_LABELS[product.blockedBy]} since {formatDate(toLocalDate(product.blockedSince!))}: {product.blockedReason}
          </span>
        </div>
      )}
    </Card>
  );
}

function CancelledBand({ product }: { product: Product }) {
  return (
    <div className="rounded-md border border-border bg-tint p-4 text-text-secondary">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral-outline">{SCHEME_LABELS[product.product]}</Badge>
        <span className="font-medium">{product.country}</span>
        <span className="flex-1" />
        <Badge variant="muted">Cancelled on {formatDate(toLocalDate(product.cancelledAt!))}</Badge>
      </div>
      {product.cancelReason && <p className="mt-2 text-meta">Reason: {product.cancelReason}</p>}
    </div>
  );
}

export default async function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadProductsData(id), getCurrentUser()]);
  if (!data) notFound();

  const canEdit = can(user, "product.stage.change").ok;
  const active = data.products.filter((p) => p.cancelledAt === null);
  const cancelled = data.products.filter((p) => p.cancelledAt !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-section">Products &amp; onboarding</h2>
        {active.length > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-tint text-[12px] font-medium text-text-secondary">
            {active.length}
          </span>
        )}
        <span className="text-meta text-text-secondary">Ordered by target go-live</span>
        <span className="flex-1" />
        {!canEdit && <OwnedBy label={ownedByLabel([Team.OPS])} />}
      </div>

      {active.length === 0 ? (
        <p className="text-meta text-text-secondary">
          No products contracted yet. Products are added in the customer handoff (Sales) or with Add product line (Ops).
        </p>
      ) : (
        active.map((p) => <ProductBand key={p.id} data={data} product={p} canEdit={canEdit} />)
      )}

      {cancelled.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-meta text-text-secondary">
            Cancelled product lines ({cancelled.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {cancelled.map((p) => (
              <CancelledBand key={p.id} product={p} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
