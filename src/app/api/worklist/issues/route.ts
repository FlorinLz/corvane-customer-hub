import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { loadWorklistIssues } from "@/server/queries/worklist/issues";

// Brief 4.6.9 "GET /api/worklist/issues". Every active user of the 6
// teams reads their own rows; there is no team gate here, the query
// itself only ever returns rows the caller holds a role on (or, with
// ?scope=team for Ops/CS, their team's own rows).
export const GET = handle("worklist.issues", async (req: Request) => {
  const user = await getCurrentUser();
  const scope = new URL(req.url).searchParams.get("scope") === "team" ? "team" : "mine";
  return loadWorklistIssues(user, scope);
});
