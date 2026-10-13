"use client";

import { catchError } from "next/error";

/**
 * Brief 5.3 summary strip: a pill whose own query fails just disappears
 * instead of showing an error of its own -- the section it links to is
 * already the authoritative error state with "Could not load this
 * list" and Retry (WorklistErrorBoundary, brief 4.6.1). `catchError`
 * (Next 16.3+) is Client-Component-only, same as WorklistErrorBoundary,
 * so this lives in its own "use client" file.
 */
export const PillErrorBoundary = catchError(() => null);
