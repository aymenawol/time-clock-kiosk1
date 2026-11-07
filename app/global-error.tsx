"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>RoleCall hit an error</h1>
          <p style={{ color: "#5b6676" }}>Reload the page to continue.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
