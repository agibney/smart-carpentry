// Cookie-based session storage for the logged-in user. Framework-mode SSR means this only
// ever runs on the RR7 server (see lib/api.ts's own header comment) — the browser holds an
// opaque, signed, httpOnly cookie and never sees a Keycloak token directly.
import { createCookieSessionStorage } from 'react-router'

export type SessionData = {
  sub: string
  name: string
  roles: string[]
  // null for a global-admin session (no business group membership) — see
  // api/src/middleware/auth.ts for the server-side equivalent of this same distinction.
  businessId: string | null
  // The refresh token, not the access token — access tokens are minted per-request via the
  // refresh grant (see auth.server.ts) instead of being stored directly. This keeps the
  // cookie small and avoids ever risking the ~4KB cookie-size ceiling as roles/groups grow.
  refreshToken: string
}

const secret = process.env.SESSION_SECRET
if (!secret) {
  throw new Error('SESSION_SECRET must be set — see web/.env.example')
}

export const sessionStorage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: '__session',
    httpOnly: true,
    sameSite: 'lax',
    secrets: [secret],
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
})

// Short-lived cookie carrying PKCE/state across the redirect to Keycloak and back — separate
// from the long-lived session above since it only needs to survive one round trip.
export type AuthFlowData = {
  codeVerifier: string
  state: string
  returnTo: string
}

export const authFlowStorage = createCookieSessionStorage<AuthFlowData>({
  cookie: {
    name: '__auth_flow',
    httpOnly: true,
    sameSite: 'lax',
    secrets: [secret],
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  },
})