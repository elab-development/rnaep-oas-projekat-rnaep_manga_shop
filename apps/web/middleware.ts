import { NextResponse, type NextRequest } from "next/server"

/**
 * Security-headers chokepoint for the frontend (issue 13, ADR-0012).
 *
 * The JWT lives in `localStorage` and rides the `Authorization` header, never a
 * cookie — so CSRF is mitigated by design and XSS becomes the load-bearing risk.
 * A strict Content-Security-Policy is therefore load-bearing, not optional. We
 * emit it here so every document response carries a fresh per-request nonce.
 *
 * `script-src` is genuinely strict: only same-origin scripts and scripts
 * carrying this request's nonce run, and `'strict-dynamic'` lets those trusted
 * scripts load their own chunks without re-allowlisting Next's hashed bundles.
 * Next reads the nonce back out of the CSP request header and stamps it onto its
 * own framework `<script>` tags automatically; `next-themes`' inline anti-flash
 * script gets the same nonce via its `nonce` prop in the root layout. `style-src`
 * keeps `'unsafe-inline'` — style injection can't execute JavaScript, and it
 * spares us fighting `next/font`'s injected styles for no security gain.
 */

/** Browser-reachable gateway origin the client fetches (ADR-0011), for `connect-src`. */
function gatewayOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3000"
  try {
    return new URL(raw).origin
  } catch {
    return "http://localhost:3000"
  }
}

/** Builds the CSP for a request, binding scripts to `nonce`. Pure, for readability/testing. */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    // Cover art is a snapshot of an external CDN (Jikan/MyAnimeList) shown via a
    // plain <img>; images cannot execute script, so allowing https here is safe.
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self' ${gatewayOrigin()}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ")
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildContentSecurityPolicy(nonce)

  // Forward the nonce + CSP on the *request* so Next applies the nonce to its own
  // scripts and the layout can read `x-nonce` for next-themes.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set("content-security-policy", csp)
  // Defense-in-depth headers that pair with the header-token/XSS posture.
  response.headers.set("x-content-type-options", "nosniff")
  response.headers.set("x-frame-options", "DENY")
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin")

  return response
}

export const config = {
  // Apply to document/navigation requests; skip static assets and prefetches so a
  // nonce is never baked into a cached/prefetched response.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
