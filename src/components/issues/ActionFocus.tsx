"use client";

import * as React from "react";

/**
 * For the message steps (Record notification, Record update, Confirm resolution, Record report sent) the one filled primary button is the
 * Message panel's own: "Your next action" names the step and its time, and its button, secondary, takes the person to the panel.
 * Every other step keeps its primary in "Your next action".
 */
interface ActionFocusValue {
  /** The viewer has a row button that scrolls to the message panel. */
  hasRowButton: boolean;
  scrolled: boolean;
  scrollToMessage: () => void;
}

const Ctx = React.createContext<ActionFocusValue>({ hasRowButton: false, scrolled: false, scrollToMessage: () => {} });

export const MESSAGE_PANEL_ID = "message-to-customer";

export function ActionFocusProvider({ hasRowButton, children }: { hasRowButton: boolean; children: React.ReactNode }) {
  const [scrolled, setScrolled] = React.useState(false);
  const scrollToMessage = React.useCallback(() => {
    document.getElementById(MESSAGE_PANEL_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrolled(true);
  }, []);
  const value = React.useMemo(() => ({ hasRowButton, scrolled, scrollToMessage }), [hasRowButton, scrolled, scrollToMessage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActionFocus() {
  const { hasRowButton, scrolled, scrollToMessage } = React.useContext(Ctx);
  return { scrollToMessage, hasRowButton, scrolled, rowVariant: "secondary" as const, panelVariant: "primary" as const };
}
