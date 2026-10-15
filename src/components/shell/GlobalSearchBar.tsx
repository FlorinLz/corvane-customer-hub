"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

// Brief 5.2 Global search bar (M1 AC1). Enter opens /search?q=<query>.
// Typeahead is R2 (7.6.6); "/" focuses the bar from any screen (5.1.10).
export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function openSearch() {
    const query = value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <form
      role="search"
      className={cn("flex h-9 w-full max-w-[560px] min-w-[280px] items-center gap-2 rounded-sm border border-border-strong bg-white px-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        openSearch();
      }}
    >
      <Search className="size-4 text-text-secondary" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        data-onboarding="global-search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by name, alias, LEI or BIC"
        aria-label="Search by name, alias, LEI or BIC"
        className="min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-text-disabled outline-none"
      />
      {value && (
        <IconButton
          type="button"
          aria-label="Clear search"
          className="-mr-1.5 size-6"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      )}
    </form>
  );
}
