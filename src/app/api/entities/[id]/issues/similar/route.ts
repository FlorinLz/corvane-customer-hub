import { z } from "zod";
import { Scheme } from "@prisma/client";

import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { loadSimilarIssues } from "@/server/queries/issue-similar";

const schema = z.object({ scheme: z.enum(Scheme).nullable(), country: z.string().length(2).nullable() });

/**
 * Brief M17 AC5. POST rather than the brief's literal GET listing, to
 * match this app's existing `POST /api/duplicates/check` precedent for
 * a live "while you fill the form" lookup (DECISIONS.md).
 */
export const POST = handle("entity.issuesSimilar", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await getCurrentUser(); // every active user of the 6 teams; no team-specific gate
  const input = parseBody(schema, await readJson(req));
  return loadSimilarIssues(id, input.scheme, input.country);
}, { writes: false });
