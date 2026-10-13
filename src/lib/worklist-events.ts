"use client";

// Brief 4.6.9/5.2 "refresh after action": HomeLink's badge lives in the
// root layout and is never remounted by a router.refresh(), so an inline
// action that changes it (e.g. Acknowledge) notifies it directly instead
// of waiting for the next 60-second poll.
export const WORKLIST_REFRESH_EVENT = "worklist:refresh";

export function notifyWorklistChanged() {
  window.dispatchEvent(new Event(WORKLIST_REFRESH_EVENT));
}
