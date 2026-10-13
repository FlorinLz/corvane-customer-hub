// Brief 3.1.2: "Client components hold forms and dialogs and call
// lib/api-client." One fetch wrapper so every M5 dialog parses the same
// 3.1.3 error shapes the same way instead of repeating a switch per form.
// `kind` (not `status`) is the discriminant: a plain numeric `status`
// can't narrow a union that also has a catch-all numeric status branch.
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "validation"; status: 400; fieldErrors: Record<string, string[]> }
  | { ok: false; kind: "forbidden"; status: 403; ownerTeam: string }
  | { ok: false; kind: "issue_forbidden"; status: 403; code: string; message: string }
  | { ok: false; kind: "not_found"; status: 404 }
  | { ok: false; kind: "conflict"; status: 409; message: string; needsConfirmation: boolean }
  | { ok: false; kind: "deleted"; status: 410; message: string }
  | { ok: false; kind: "unavailable"; status: 503 }
  | { ok: false; kind: "error"; status: number; message: string };

async function toApiResult<T>(res: Response | null): Promise<ApiResult<T>> {
  if (!res) return { ok: false, kind: "error", status: 0, message: "Could not reach the server. Check your connection and try again." };

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // no body (e.g. a 204) — fall through with json = null
  }
  const j = (json ?? {}) as Record<string, unknown>;

  if (res.ok) return { ok: true, data: (j.data as T) ?? (j as T) };

  switch (res.status) {
    case 400:
      return { ok: false, kind: "validation", status: 400, fieldErrors: (j.fieldErrors as Record<string, string[]>) ?? {} };
    case 403:
      // Issue-flow 403s carry a code+message (brief 4.9.12) instead of the matrix's owner_team shape.
      if (typeof j.code === "string") {
        return { ok: false, kind: "issue_forbidden", status: 403, code: j.code, message: (j.message as string) ?? "You can't do that." };
      }
      return { ok: false, kind: "forbidden", status: 403, ownerTeam: (j.owner_team as string) ?? "" };
    case 404:
      return { ok: false, kind: "not_found", status: 404 };
    case 409:
      return {
        ok: false,
        kind: "conflict",
        status: 409,
        message: (j.message as string) ?? "This was changed by someone else. Reload and try again.",
        needsConfirmation: Boolean(j.needsConfirmation),
      };
    case 410:
      return { ok: false, kind: "deleted", status: 410, message: (j.message as string) ?? "This record was deleted." };
    case 503:
      return { ok: false, kind: "unavailable", status: 503 };
    default:
      return { ok: false, kind: "error", status: res.status, message: (j.message as string) ?? "Something went wrong. Try again." };
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  let res: Response | null = null;
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // res stays null -- toApiResult() maps it to the "could not reach the server" result.
  }
  return toApiResult<T>(res);
}

/** GET, for on-demand context the server component didn't already load (e.g. the report drawer's issue context, fetched only when it opens). */
export async function apiGet<T = unknown>(path: string): Promise<ApiResult<T>> {
  let res: Response | null = null;
  try {
    res = await fetch(path);
  } catch {
    // res stays null -- toApiResult() maps it to the "could not reach the server" result.
  }
  return toApiResult<T>(res);
}
