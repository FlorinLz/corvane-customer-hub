"use client";

import { Analytics } from "@vercel/analytics/next";

/** Vercel Web Analytics, page views only. The query string is dropped before sending: /search?q= holds whatever the visitor typed. */
export function PageViews() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          url.search = "";
          url.hash = "";
          return { ...event, url: url.toString() };
        } catch {
          return null;
        }
      }}
    />
  );
}
