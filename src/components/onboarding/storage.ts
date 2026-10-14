import * as React from "react";

/** localStorage that never throws: blocked storage (private windows, cleared site data) just remembers nothing. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered. The card then shows once per page load, and can still be closed.
  }
}

const noopSubscribe = () => () => undefined;

/** False while the server HTML is hydrated, true after: what reads the browser's storage may differ from the server's render only then. */
export function useIsClient(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}
