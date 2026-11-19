"use client"; // Error boundaries must be Client Components

/**
 * Last resort, when even the site's own layout fails. It replaces the whole
 * page, so it carries its own minimal styles (in the site's colours, light and
 * dark) instead of the app's stylesheet.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <title>Something went wrong · Tripster</title>
        <style>{`
          body { background: #eef2f0; color: #1c3a32; }
          button { background: #f4c430; color: #1c3a32; }
          @media (prefers-color-scheme: dark) { body { background: #12241f; color: #e6eeea; } }
        `}</style>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>Tripster didn&apos;t load. Your trips are safe; try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ border: 0, borderRadius: 12, padding: "12px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
