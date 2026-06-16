'use client'

// Last-resort boundary for errors thrown in the root layout itself.
// Must render its own <html>/<body> and cannot rely on app styling.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ background: '#030712', color: '#fff', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>The app failed to load</h2>
            <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>
              An unexpected error occurred. Please reload the page.
            </p>
            {error?.digest && (
              <p style={{ color: '#6b7280', fontSize: 12, marginTop: 12, fontFamily: 'monospace' }}>Ref: {error.digest}</p>
            )}
            <button
              onClick={reset}
              style={{ marginTop: 20, padding: '10px 20px', borderRadius: 12, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
