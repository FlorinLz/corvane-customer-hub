import * as React from "react";

/**
 * Lets a dialog that normally renders its own trigger button be opened from
 * elsewhere (the Issue header's "More actions" menu): with `controlled`, the
 * dialog renders no trigger and follows the caller's open state.
 */
export interface ControlledOpen {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useOpenState(controlled?: ControlledOpen): [boolean, (open: boolean) => void] {
  const [inner, setInner] = React.useState(false);
  return controlled ? [controlled.open, controlled.onOpenChange] : [inner, setInner];
}
