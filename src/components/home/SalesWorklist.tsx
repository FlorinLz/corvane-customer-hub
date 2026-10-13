import { ownershipAssignedToYou } from "@/server/queries/worklist/mine";
import { SectionCard } from "@/components/home/SectionCard";
import { OwnershipAssignedSection } from "@/components/home/OwnershipAssignedSection";

/** Brief 7.6.5: Sales's own 3 sections (Awaiting pickup, Overdue go-lives, Champion left) are R2 -- only the shared "Ownership assigned to you" section is R1 for Sales. */
export async function SalesWorklist({ userId }: { userId: string }) {
  const assigned = await ownershipAssignedToYou(userId);
  return (
    <SectionCard id="worklist-ownership-assigned" title="Ownership assigned to you" count={assigned.length}>
      <OwnershipAssignedSection rows={assigned} />
    </SectionCard>
  );
}

export async function salesWorklistIsEmpty(userId: string): Promise<boolean> {
  const assigned = await ownershipAssignedToYou(userId);
  return assigned.length === 0;
}
