import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";

import { DemoStrip } from "@/components/shell/DemoStrip";
import { TopBar } from "@/components/shell/TopBar";
import { Toaster } from "@/components/ui/toaster";
import { now } from "@/lib/dates";
import { getCurrentUser } from "@/server/session";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
  const user = await getCurrentUser();

  return (
    <html lang="en-GB" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="flex min-h-full flex-col bg-background text-text" suppressHydrationWarning>
        {demoMode && <DemoStrip currentEmail={user.email} serverNow={now()} />}
        <TopBar user={user} demoMode={demoMode} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
