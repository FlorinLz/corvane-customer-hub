import type { Metadata } from "next";
import localFont from "next/font/local";

import { DemoStrip } from "@/components/shell/DemoStrip";
import { PreparingDemo } from "@/components/shell/PreparingDemo";
import { TopBar } from "@/components/shell/TopBar";
import { Toaster } from "@/components/ui/toaster";
import { now } from "@/lib/dates";
import { demoNeedsPreparing } from "@/server/demo-gate";
import { getCurrentUser } from "@/server/session";
import "@/server/request-clock"; // registers the per-visitor clock for now() on the server

import "./globals.css";

// DM Sans and DM Mono, served from src/fonts (the latin subset, OFL licence next to them). They used to come from
// next/font/google, which downloads them at build time: one Vercel build failed when that request failed.
const dmSans = localFont({
  src: [
    { path: "../fonts/dm-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/dm-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/dm-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dm-sans",
});

const dmMono = localFont({
  src: [
    { path: "../fonts/dm-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Customer Hub · Corvane",
  description: "Customer Hub · Corvane: the single record for every customer and partner institution.",
};

// Brief 5.2 S0 app shell. Reads the real session (src/server/session.ts,
// milestone 2): the ch_user cookie, or DEMO_DEFAULT_USER_EMAIL (Adrian
// Koh, decision B8) when DEMO_MODE=true and no cookie is set yet.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.DEMO_MODE === "true";

  // Idle restore (src/server/demo-idle.ts): when the demo is due for a restore, a restore is running, or this visitor arrived before the
  // last one, nothing of the app renders (its queries would hit tables mid-restore) until the "Preparing a fresh demo..." screen has
  // waited for it.
  if (await demoNeedsPreparing()) {
    return (
      <html lang="en-GB" className={`${dmSans.variable} ${dmMono.variable}`}>
        <body className="flex min-h-full flex-col bg-background text-text" suppressHydrationWarning>
          <PreparingDemo />
        </body>
      </html>
    );
  }

  const user = await getCurrentUser();
  // The browser's now() = the server's demo now at this render + the browser's own time since this script ran (src/lib/dates.ts).
  const serverNowMs = now().getTime();

  return (
    <html lang="en-GB" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="flex min-h-full flex-col bg-background text-text" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `window.__chClockOffsetMs=${serverNowMs}-Date.now()` }} />
        {demoMode && <DemoStrip currentEmail={user.email} serverNow={now()} />}
        <TopBar user={user} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
