"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0b0c10", color: "#e7e9ee", fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 600, margin: "10vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, color: "#9aa1ad" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 8,
              background: "#6d8bff",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
