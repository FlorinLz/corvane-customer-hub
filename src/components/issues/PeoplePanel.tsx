import type { Team } from "@prisma/client";

import { TEAM_LABELS } from "@/lib/labels";
import { ContributorsPanel } from "@/components/issues/ContributorsPanel";
import { WhyThis } from "@/components/onboarding/WhyThis";

interface Contributor {
  userId: string;
  name: string;
  team: Team;
  /** Added when the root cause report task was created (M27 AC4). */
  forReport?: boolean;
}

/** Brief M18 AC9 "Why this owner", M21 AC6. */
export function PeoplePanel({
  issueId,
  version,
  isOwner,
  ownerName,
  ownerTeam,
  communicatorLabel,
  reporterName,
  reporterTeam,
  routingReason,
  contributors,
}: {
  issueId: string;
  version: number;
  isOwner: boolean;
  ownerName: string | null;
  ownerTeam: Team;
  communicatorLabel: string;
  reporterName: string;
  reporterTeam: Team | null;
  routingReason: string;
  contributors: Contributor[];
}) {
  return (
    <div data-onboarding="people" className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex items-center gap-1">
        <h3 className="text-subsection">People</h3>
        <WhyThis note="owner-communicator" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta text-text-secondary">Owner</span>
        <span className="text-body">{ownerName ? `${ownerName} (${TEAM_LABELS[ownerTeam]})` : `Assigned at the start of ${TEAM_LABELS[ownerTeam]} business hours`}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-meta text-text-secondary">Communicator</span>
        <span className="text-body">{communicatorLabel}</span>
      </div>
      <ContributorsPanel issueId={issueId} version={version} isOwner={isOwner} contributors={contributors} />
      <div className="flex flex-col gap-1">
        <span className="text-meta text-text-secondary">Reporter</span>
        <span className="text-body">
          {reporterName}
          {reporterTeam && ` (${TEAM_LABELS[reporterTeam]})`}
        </span>
      </div>
      <p className="border-t border-border pt-3 text-meta text-text-secondary">Why this owner: {routingReason}</p>
    </div>
  );
}
