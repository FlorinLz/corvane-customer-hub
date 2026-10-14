import { NextResponse } from "next/server";

// There is no public reset. The demo restores itself after 20 minutes without changes (src/server/demo-idle.ts) and once a day
// (/api/cron/demo-restore). `npm run demo:reset-data` is the manual way. Every method answers 404.
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
