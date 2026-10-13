import type { z } from "zod";

import { ValidationError } from "@/server/errors";

/**
 * Brief 3.1.3 step 4: "Zod schema from `lib/validation` ... 400 on
 * failure" with body `{"error":"validation","fieldErrors":{"<field>":
 * ["<message>"]}}`. One place to turn a zod failure into that shape so
 * every route parses its body the same way.
 */
export function parseBody<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw new ValidationError(fieldErrors);
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => ({}));
}
