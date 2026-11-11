"use client";

import { themeColors as c } from "@/lib/themeColors";

/** Last-resort boundary if the root layout itself fails (renders its own <html>). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: c.surface, color: c.onSurface }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: c.onSurfaceVariant }}>The app failed to load. Your saved data is safe.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: c.primary, color: c.onPrimary, fontWeight: 600 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
