import { stripLinkedPrefix } from "@/lib/issue-text";
import { EditDescriptionDialog } from "@/components/issues/EditDescriptionDialog";

/**
 * "Issue description": the description in a card with a primary bar. A linked issue's stored text starts with a pointer
 * to its partner issue; that is not shown here (the "Linked issue" row says it). The reporter can still edit it while the issue is New.
 */
export function IssueDescription({ issueId, version, description, canEdit }: { issueId: string; version: number; description: string; canEdit: boolean }) {
  return (
    <section aria-label="Issue description" className="flex items-start gap-3 rounded-md border border-l-4 border-border border-l-primary bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-primary">Issue description</h2>
        <p className="whitespace-pre-line text-[18px] font-medium leading-[26px] text-text" data-testid="issue-description">
          {stripLinkedPrefix(description)}
        </p>
      </div>
      {canEdit && <EditDescriptionDialog issueId={issueId} version={version} currentDescription={description} />}
    </section>
  );
}
