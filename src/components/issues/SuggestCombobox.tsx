"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SuggestOption {
  value: string;
  label: string;
}

/**
 * A field you can type in to filter. Options come in two groups: "Suggested" (the entity's own countries and schemes) first, then
 * "All others" A to Z. Arrow keys move, Enter picks, Escape closes the list (a second Escape closes the drawer).
 */
export function SuggestCombobox({
  id,
  label,
  value,
  onChange,
  suggested,
  others,
  placeholder = "Select",
  invalid,
}: {
  id: string;
  /** The accessible name of the field. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggested: SuggestOption[];
  others: SuggestOption[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const all = React.useMemo(() => [...suggested, ...others], [suggested, others]);
  const selected = all.find((o) => o.value === value) ?? null;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const matches = (o: SuggestOption) => q === "" || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
  const shownSuggested = suggested.filter(matches);
  const shownOthers = others.filter(matches);
  const flat = [...shownSuggested, ...shownOthers];

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(o: SuggestOption) {
    onChange(o.value);
    setQuery("");
    setOpen(false);
  }

  const optionClass = (isActive: boolean, isSelected: boolean) =>
    cn("flex cursor-pointer items-center px-3 py-1.5 text-body", isActive && "bg-tint-strong", isSelected && "font-semibold");

  const renderGroup = (title: string, items: SuggestOption[], offset: number) =>
    items.length === 0 ? null : (
      <div role="group" aria-label={title}>
        <div className="px-3 pb-0.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-secondary">{title}</div>
        {items.map((o, i) => (
          <div
            key={o.value}
            role="option"
            aria-selected={o.value === value}
            className={optionClass(offset + i === active, o.value === value)}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(o);
            }}
            onMouseEnter={() => setActive(offset + i)}
          >
            {o.label}
          </div>
        ))}
      </div>
    );

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-invalid={invalid}
        autoComplete="off"
        value={open ? query : (selected?.label ?? "")}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(flat.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && flat[active]) {
            e.preventDefault();
            pick(flat[active]);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
            setQuery("");
          }
        }}
        className="h-9 w-full rounded-sm border border-border-strong bg-white px-3 pr-8 text-body outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary aria-[invalid=true]:border-danger"
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-text-secondary" aria-hidden="true" />
      {open && (
        <div id={`${id}-list`} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-border bg-white py-1 shadow-lg">
          {flat.length === 0 && <div className="px-3 py-2 text-meta text-text-secondary">No match</div>}
          {renderGroup("Suggested", shownSuggested, 0)}
          {renderGroup(suggested.length > 0 ? "All others" : "All", shownOthers, shownSuggested.length)}
        </div>
      )}
    </div>
  );
}
