import type { CommunicatorRule } from "@prisma/client";

// Brief 4.9.7. Pure read-time computation only -- the on-read system
// writes (hand-over, customer-owner-changed) that accompany this in the
// full spec are 6B's `ensureSystemWrites()`/`onCustomerOwnerChanged()`
// territory; 6A only needs the answer itself (report-confirmation data,
// seed assertions).
export interface CommunicatorIssue {
  communicatorRule: CommunicatorRule;
  ownerId: string | null;
  handoverAt: Date | null;
  takenOverById?: string | null;
}

/** null means "No communicator: set an owner on the entity" (M18 edge case 6). */
export function effectiveCommunicator(issue: CommunicatorIssue, entity: { ownerId: string | null }, now: Date): string | null {
  switch (issue.communicatorRule) {
    case "ISSUE_OWNER_PARTNER":
      return issue.ownerId; // moves with the owner (M21 AC9)
    case "ISSUE_OWNER_UNTIL_HANDOVER":
      return now < issue.handoverAt! ? issue.ownerId : entity.ownerId;
    case "TAKEN_OVER":
      return issue.takenOverById ?? null; // R2
    default:
      return entity.ownerId;
  }
}
