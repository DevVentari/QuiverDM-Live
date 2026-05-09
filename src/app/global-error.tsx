'use client'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  return (
    <html lang="en">
      <body style={{ background: '#111', color: '#eee', fontFamily: 'monospace', padding: '2rem' }}>
        <h1 style={{ color: '#f87', marginBottom: '1rem' }}>Global Error</h1>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '13px' }}>
          {error.message}
          {'\n\n'}
          {error.stack}
          {'\n\nDigest: '}
          {error.digest}
        </pre>
      </body>
    </html>
  )
}
