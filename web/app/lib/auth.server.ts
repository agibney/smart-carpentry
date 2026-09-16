// Server-side OIDC (Authorization Code + PKCE) against Keycloak, using openid-client rather
// than a browser-SPA library (keycloak-js / react-oidc-context / @react-keycloak/*) — those
// assume client-side redirects and React context, the wrong shape for an SSR-only app
// (react-router.config.ts sets ssr: true) where every loader/action runs server-side and the
// browser never holds a token at all.
import { decodeJwt } from 'jose'
import * as client from 'openid-client'
import { redirect } from 'react-router'
import { authFlowStorage, sessionStorage, type SessionData } from './session.server'

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080'
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'carpentry'
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? 'web-app'
const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173'

let configPromise: Promise<client.Configuration> | undefined

// Discovery is cached for the life of the server process — the realm's metadata/JWKS don't
// change on every request, and re-discovering per-request would be a needless round trip.
function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const issuer = new URL(`${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`)
    // web-app is a public client (no secret) — client.None() is required to tell openid-client
    // not to attempt client_secret_basic auth, which is the library's default assumption.
    //
    // openid-client v6 refuses non-HTTPS discovery/token requests by default (throws "only
    // requests to HTTPS are allowed") — there's no automatic localhost exception, unlike some
    // other OIDC libraries. Local dev runs Keycloak over plain HTTP (docker-compose.yml's
    // KC_HTTP_ENABLED, no TLS termination), so allowInsecureRequests is opted into whenever
    // KEYCLOAK_BASE_URL is http: — this never weakens a real https: deployment, since the
    // issuer URL's own scheme is what actually determines whether TLS is used on the wire.
    const execute = issuer.protocol === 'http:' ? [client.allowInsecureRequests] : []
    configPromise = client.discovery(issuer, KEYCLOAK_CLIENT_ID, undefined, client.None(), { execute })
  }
  return configPromise
}

/** Builds the redirect to Keycloak's hosted login page and stashes PKCE state in a short-lived
 * cookie for auth.callback.tsx to pick back up. `returnTo` is where the user lands after a
 * successful login. */
export async function buildLoginRedirect(returnTo: string): Promise<Response> {
  const config = await getOidcConfig()

  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const state = client.randomState()

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: `${WEB_PUBLIC_URL}/auth/callback`,
    scope: 'openid profile email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  const flowSession = await authFlowStorage.getSession()
  flowSession.set('codeVerifier', codeVerifier)
  flowSession.set('state', state)
  flowSession.set('returnTo', returnTo)

  return redirect(authorizationUrl.href, {
    headers: { 'Set-Cookie': await authFlowStorage.commitSession(flowSession) },
  })
}

/** Exchanges the authorization code for tokens, writes the long-lived session cookie, and
 * redirects to wherever buildLoginRedirect was asked to return to. */
export async function handleLoginCallback(request: Request): Promise<Response> {
  const flowSession = await authFlowStorage.getSession(request.headers.get('Cookie'))
  const codeVerifier = flowSession.get('codeVerifier')
  const state = flowSession.get('state')
  const returnTo = flowSession.get('returnTo') ?? '/'

  if (!codeVerifier || !state) {
    throw redirect('/auth/login')
  }

  const config = await getOidcConfig()
  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>
  try {
    tokens = await client.authorizationCodeGrant(config, new URL(request.url), {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })
  } catch {
    // An expired or already-consumed code (e.g. the callback URL got reloaded, or the flow
    // took too long) — same recovery as any other invalid auth attempt: back to login, not an
    // unhandled exception surfaced to RR7's generic error boundary.
    throw redirect('/auth/login')
  }

  const claims = tokens.claims()
  if (!claims?.sub || !tokens.refresh_token) {
    throw new Error('Keycloak token response is missing expected claims/refresh_token')
  }

  // Keycloak's built-in "realm roles" mapper defaults to including realm_access.roles on the
  // *access* token only, not the ID token — unlike the custom `groups` mapper on this client
  // (carpentry-realm.json), which was explicitly configured with id.token.claim: true. Rather
  // than editing Keycloak's default mapper config, read roles off the access token instead —
  // same token/claim shape api/'s own auth middleware already trusts for this. Not signature-
  // verified here since it came directly from Keycloak's token endpoint over this same
  // authenticated exchange, not from an untrusted caller.
  const roles = extractRoles(decodeJwt(tokens.access_token))
  const businessId = extractBusinessId(claims)

  const session = await sessionStorage.getSession()
  session.set('sub', claims.sub)
  session.set('name', (claims.name as string | undefined) ?? (claims.preferred_username as string | undefined) ?? 'Unknown')
  session.set('roles', roles)
  session.set('businessId', businessId)
  session.set('refreshToken', tokens.refresh_token)

  // A global-admin session always lands on /admin/businesses, ignoring returnTo — a
  // global-admin has no business group, so any returnTo pointing at a business-scoped page
  // (e.g. requireBusinessSession redirected here from /projects) would just 403 immediately
  // via requireBusinessSession's own check. Once global-admins can see business-scoped
  // pages too (a "super-admin, access everything" mode — noted as future work, not yet
  // built), this can go back to respecting returnTo unconditionally.
  const target = roles.includes('global-admin') ? '/admin/businesses' : returnTo !== '/' ? returnTo : '/projects'

  return redirect(target, {
    headers: [
      ['Set-Cookie', await sessionStorage.commitSession(session)],
      ['Set-Cookie', await authFlowStorage.destroySession(flowSession)],
    ],
  })
}

/** RP-initiated logout — ends the Keycloak session as well as the local cookie, so a
 * subsequent login doesn't silently reuse an existing Keycloak SSO session. */
export async function handleLogout(request: Request): Promise<Response> {
  const config = await getOidcConfig()
  const session = await sessionStorage.getSession(request.headers.get('Cookie'))

  const endSessionUrl = client.buildEndSessionUrl(config, {
    post_logout_redirect_uri: WEB_PUBLIC_URL,
  })

  return redirect(endSessionUrl.href, {
    headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
  })
}

function extractRoles(claims: Record<string, unknown>): string[] {
  const realmAccess = claims.realm_access as { roles?: string[] } | undefined
  return realmAccess?.roles ?? []
}

const BUSINESS_GROUP_PATTERN = /^\/businesses\/([0-9a-f-]{36})$/i

function extractBusinessId(claims: Record<string, unknown>): string | null {
  const groups = (claims.groups as string[] | undefined) ?? []
  for (const group of groups) {
    const match = BUSINESS_GROUP_PATTERN.exec(group)
    if (match) return match[1]
  }
  return null
}

type ValidSession = { data: SessionData; accessToken: string; setCookieHeader?: string }

// React Router runs every matched route's loader for a navigation concurrently — root.tsx's
// loader (getOptionalSession) and a leaf route's loader (requireBusinessSession/
// requireGlobalSession) both call loadValidSession for the *same* incoming request. Since
// Keycloak rotates refresh tokens on use (see the comment below), two concurrent calls
// submitting the same refresh token race: the loser gets invalid_grant and reads as "not
// logged in," bouncing a genuinely-authenticated user back to login. RR7 passes the same
// Request object instance to every loader in one navigation, so a WeakMap keyed on it dedups
// this correctly — one shared refresh per request, and the entry is naturally freed once the
// request is done (no manual cache invalidation needed).
const sessionCache = new WeakMap<Request, Promise<ValidSession | null>>()

/** Loads the session, refreshing the access token via the stored refresh token (see
 * session.server.ts's comment on why the refresh token, not the access token, is what's
 * stored). Returns null if there's no session or the refresh token itself has expired/been
 * revoked — callers redirect to login in that case. Memoized per-request; see sessionCache. */
function loadValidSession(request: Request): Promise<ValidSession | null> {
  const cached = sessionCache.get(request)
  if (cached) return cached

  const promise = loadValidSessionUncached(request)
  sessionCache.set(request, promise)
  return promise
}

async function loadValidSessionUncached(request: Request): Promise<ValidSession | null> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'))
  const refreshToken = session.get('refreshToken')
  if (!refreshToken) return null

  const config = await getOidcConfig()
  let tokens: client.TokenEndpointResponse
  try {
    tokens = await client.refreshTokenGrant(config, refreshToken)
  } catch {
    return null
  }

  let setCookieHeader: string | undefined
  // Keycloak rotates refresh tokens on use — persist the new one so the next request's
  // refresh doesn't fail against an already-consumed token.
  if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
    session.set('refreshToken', tokens.refresh_token)
    setCookieHeader = await sessionStorage.commitSession(session)
  }

  return { data: session.data as SessionData, accessToken: tokens.access_token, setCookieHeader }
}

function toHeaders(setCookieHeader?: string): HeadersInit | undefined {
  return setCookieHeader ? { 'Set-Cookie': setCookieHeader } : undefined
}

/** Guard for business-scoped routes (projects, clients, ...) — see the shared pattern in the
 * plan doc, applied identically across web/app/routes/projects*.tsx.
 *
 * Important distinction: "no valid session" redirects to login, but "valid session that just
 * isn't a business one" (a global-admin visiting a business route) throws a 403 instead of
 * redirecting to login — that user IS authenticated, so bouncing them to /auth/login would
 * silently re-use their existing Keycloak SSO session and redirect straight back here,
 * looping forever. */
export async function requireBusinessSession(
  request: Request,
): Promise<{ accessToken: string; businessId: string; user: SessionData; headers?: HeadersInit }> {
  const valid = await loadValidSession(request)
  if (!valid) {
    throw await buildLoginRedirect(new URL(request.url).pathname)
  }
  if (valid.data.businessId === null) {
    throw new Response('This page requires a business account, not a global-admin one.', { status: 403 })
  }
  return { accessToken: valid.accessToken, businessId: valid.data.businessId, user: valid.data, headers: toHeaders(valid.setCookieHeader) }
}

/** Guard for global-admin-only routes (the business-creation admin page). Same "session exists
 * but wrong role → 403, not a login-redirect loop" reasoning as requireBusinessSession. */
export async function requireGlobalSession(
  request: Request,
): Promise<{ accessToken: string; user: SessionData; headers?: HeadersInit }> {
  const valid = await loadValidSession(request)
  if (!valid) {
    throw await buildLoginRedirect(new URL(request.url).pathname)
  }
  if (!valid.data.roles.includes('global-admin')) {
    throw new Response('This page requires a global-admin account.', { status: 403 })
  }
  return { accessToken: valid.accessToken, user: valid.data, headers: toHeaders(valid.setCookieHeader) }
}

/** Non-throwing read for root.tsx's loader — used for nav/logged-in-state UI, never redirects. */
export async function getOptionalSession(request: Request): Promise<SessionData | null> {
  const valid = await loadValidSession(request)
  return valid?.data ?? null
}