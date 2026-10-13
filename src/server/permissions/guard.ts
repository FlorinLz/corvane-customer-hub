import { can, type Action, type Resource, type SessionUser } from "@/server/permissions/can";

/** Throws ForbiddenError (403) or ConflictError (409) when can() denies the action. Called first in every route handler, then again inside the transaction after re-reading the resource (brief 4.1.3). */
export function assertCan(user: SessionUser, action: Action, resource?: Resource): void {
  const decision = can(user, action, resource);
  if (!decision.ok) throw decision.error;
}
