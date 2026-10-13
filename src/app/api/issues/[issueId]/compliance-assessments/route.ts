import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { recordAssessmentSchema } from "@/lib/validation/issues";
import { recordComplianceAssessment } from "@/server/services/compliance-assessment";

// Brief 3.8.3, M25 AC6. Compliance only.
export const POST = handle("issue.compliance", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(recordAssessmentSchema, await readJson(req));
  const assessment = await recordComplianceAssessment(user, issueId, input);
  return { id: assessment.id, outcome: assessment.outcome, assessedAt: assessment.assessedAt };
});
