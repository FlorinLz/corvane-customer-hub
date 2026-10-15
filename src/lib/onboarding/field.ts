import type { Move } from "@/lib/onboarding/engine";

/**
 * Writes `text` into a field the way typing would: through the element's native value setter, then an input event, so React's controlled state
 * updates. It never submits anything.
 */
export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, text);
  else el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The text a "type" move writes: `fill`, or, when the field holds a template, the template with `move.replace` swapped for `fill`. */
export function textFor(el: HTMLInputElement | HTMLTextAreaElement, move: Pick<Move, "fill" | "replace">, fill: string): string {
  if (move.replace && el.value.includes(move.replace)) return el.value.replace(move.replace, fill);
  return fill;
}

/** Fills the field a "type" move points at. Returns false when the target is not a text field. */
export function fillField(el: Element, move: Pick<Move, "fill" | "replace">, fill: string): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  setFieldValue(el, textFor(el, move, fill));
  return true;
}

/** Whether a field already holds what its move asks for: a radio checked, a select showing the option, a text field filled (or its template completed). */
export function fieldIsFilled(el: Element, move: Pick<Move, "kind" | "option" | "replace">): boolean {
  const radio = el instanceof HTMLInputElement && el.type === "radio" ? el : el.querySelector<HTMLInputElement>('input[type="radio"]');
  if (radio) return radio.checked;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (move.replace) return !el.value.includes(move.replace);
    return el.value.trim().length >= 3;
  }
  if (move.option) return (el.textContent ?? "").includes(move.option);
  return false;
}
