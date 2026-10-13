"use client";

// Brief 5.2's "States" philosophy is per-section ("Could not load this list",
// Retry), not a whole-app crash screen -- but nothing in this app replaced
// Next's own generic fallback for a genuinely unexpected failure (a thrown
// error with no more specific boundary above it), which is unbranded and
// unhelpful. global-error.js replaces the root layout entirely when active,
// so it defines its own <html>/<body> and can't rely on the app's normal
// fonts or providers (Next's own docs: "do not include your global styles") --
// kept deliberately simple and dependency-free rather than importing the
// app's own styled components, so this page works even when something more
// fundamental than one query has failed.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <p style={{ fontSize: "16px", color: "#1a1a1a", margin: 0 }}>Something went wrong. Try again.</p>
        <button
          onClick={() => retry()}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #d0d0d0",
            background: "#ffffff",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
