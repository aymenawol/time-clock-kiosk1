/** @type {import('next').NextConfig} */

// Baseline security headers applied to every route. These are safe to enforce
// without breaking app functionality:
//   - frame-ancestors 'none' + X-Frame-Options: DENY  -> clickjacking protection
//     (admin payroll/approval screens can no longer be framed by a third party).
//   - HSTS                                            -> forbid HTTPS downgrade.
//   - nosniff / Referrer-Policy                       -> standard hardening.
//   - Permissions-Policy keeps geolocation=(self) ON  -> driver GPS still works;
//     microphone/camera are disabled (the app captures signatures via canvas and
//     photos via file input, neither of which needs those device permissions).
// NOTE: a full script/style CSP is intentionally NOT enforced here yet — Next's
// inline runtime + Google Maps need a nonce/allowlist pass first. Add it as
// Content-Security-Policy-Report-Only and promote once clean.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(), camera=()' },
]

const nextConfig = {
  typescript: {
    // Type errors fail the build (CI gate). Do not re-enable ignoreBuildErrors.
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
