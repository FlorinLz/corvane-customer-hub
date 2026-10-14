"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { DECISIONS_URL, START_HERE_URL, WELCOME, type ScenarioId } from "@/lib/onboarding/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The welcome modal: three steps, centred, about 560 px. It closes with X, Esc or a click outside (Radix Dialog). Mounted only while open,
 * so every opening starts at step 1.
 */
export function WelcomeModal({ onClose, onRun }: { onClose: () => void; onRun: (id: ScenarioId) => void }) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const title = step === 1 ? WELCOME.step1.title : step === 2 ? WELCOME.step2.title : WELCOME.step3.title;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-onboarding="welcome-modal"
          data-step={step}
          className="fixed left-1/2 top-1/2 z-50 flex w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface shadow-overlay outline-none"
        >
          <div className="flex items-start gap-2 px-8 pb-2 pt-7">
            <DialogPrimitive.Title asChild>
              <h2 className="flex-1 text-section">{title}</h2>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close" className="-mr-2 -mt-1 inline-flex size-8 items-center justify-center rounded-sm text-text-secondary hover:bg-tint hover:text-primary">
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-[260px] flex-col gap-3 px-8 pb-4 pt-2 text-body">
            {step === 1 && WELCOME.step1.paragraphs.map((p) => <p key={p}>{p}</p>)}
            {step === 2 && (
              <>
                {WELCOME.step2.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                <ol className="list-decimal space-y-1 pl-6 font-medium text-primary">
                  {WELCOME.step2.principles.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </>
            )}
            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {([1, 2] as const).map((id) => {
                    const c = WELCOME.step3.cards[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        data-onboarding={`scenario-card-${id}`}
                        onClick={() => onRun(id)}
                        className="flex flex-col gap-1 rounded-md border border-border p-4 text-left hover:border-primary hover:bg-tint"
                      >
                        <span className="text-meta font-medium text-text-secondary">{c.label}</span>
                        <span className="text-body-strong text-primary">{c.title}</span>
                        <span className="text-meta text-text-secondary">{c.text}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <Button variant="text" className="-ml-2" onClick={onClose}>
                    {WELCOME.step3.explore}
                  </Button>
                </div>
                <p className="text-meta text-text-secondary">{WELCOME.step3.note}</p>
                <p className="flex gap-4 text-meta">
                  <a href={START_HERE_URL} target="_blank" rel="noopener noreferrer" className="text-link-text hover:underline">
                    {WELCOME.howBuilt}
                  </a>
                  <a href={DECISIONS_URL} target="_blank" rel="noopener noreferrer" className="text-link-text hover:underline">
                    {WELCOME.decisions}
                  </a>
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 px-8 pb-6 pt-2">
            <div className="w-20">
              {step > 1 && (
                <Button variant="text" className="-ml-2" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>
                  {WELCOME.back}
                </Button>
              )}
            </div>
            <div className="flex flex-1 justify-center gap-2" aria-label={`Step ${step} of 3`} role="group">
              {[1, 2, 3].map((n) => (
                <span key={n} data-dot={n} data-active={n === step} className={cn("size-2 rounded-full", n === step ? "bg-primary" : "bg-neutral-300")} />
              ))}
            </div>
            <div className="flex w-20 justify-end">{step < 3 && <Button onClick={() => setStep((s) => (s + 1) as 2 | 3)}>{WELCOME.next}</Button>}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
