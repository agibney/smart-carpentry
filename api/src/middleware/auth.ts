import type { NextFunction, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { db } from '../db/index.js'
import { businesses } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { provisionUserFromToken } from '../lib/keycloak-user-sync.js'

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080'
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'carpentry'
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? 'web-app'

const ISSUER = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`

// All users — global admins and every business — share this one realm (see
// docs/requirements.md / plan: "single-realm" revision), so a single cached JWKS fetcher is
// enough; jose's createRemoteJWKSet already handles the underlying key caching/rotation.
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`))

const BUSINESS_GROUP_PATTERN = /^\/businesses\/([0-9a-f-]{36})$/i

/**
 * Verifies a Keycloak-issued bearer token and populates req.auth / req.businessId. Replaces
 * the old resolveBusiness (api/src/middleware/tenant.ts, deleted) entirely — there is no more
 * X-Business-Id/DEFAULT_BUSINESS_ID fallback; a request with no valid token gets a 401.
 *
 * Business membership comes from the token's `groups` claim (a group-membership protocol
 * mapper on the web-app client emits full paths, see keycloak/import/carpentry-realm.json) —
 * a path of the form /businesses/<uuid>. That uuid is cross-checked against the businesses
 * table rather than trusted on its own, so a stale/deleted business's group can't grant
 * access. Users in no business group (global admins) get req.businessId = null.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

  if (!token) {
    throw new HttpError(401, 'Missing Authorization: Bearer token')
  }

  let payload: Awaited<ReturnType<typeof jwtVerify>>['payload']
  try {
    ;({ payload } = await jwtVerify(token, jwks, { issuer: ISSUER, audience: KEYCLOAK_CLIENT_ID }))
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

  const sub = payload.sub
  if (!sub) {
    throw new HttpError(401, 'Token has no subject')
  }

  const realmAccess = payload.realm_access as { roles?: string[] } | undefined
  const roles = realmAccess?.roles ?? []
  const groups = (payload.groups as string[] | undefined) ?? []

  let businessId: string | null = null
  for (const group of groups) {
    const match = BUSINESS_GROUP_PATTERN.exec(group)
    if (match) {
      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, match[1]),
        columns: { id: true },
      })
      if (business) {
        businessId = business.id
      }
      break
    }
  }

  req.auth = { sub, roles, businessId }

  // JIT-provision a local users row the first time we see this subject, so `users` stays a
  // queryable mirror of Keycloak identities without a separate manual creation step.
  await provisionUserFromToken({ sub, businessId, roles, claims: payload as Record<string, unknown> })

  next()
}

/** Mounted where resolveBusiness used to sit — rejects global-admin users (req.auth.businessId
 * === null) from every tenant-scoped route, and assigns the now-guaranteed-non-null id to
 * req.businessId, restoring the "downstream routes always have a real businessId" contract
 * those routes already assume (see api/src/lib/tenant.ts scopedTo and types/express.d.ts). */
export function requireBusinessContext(req: Request, res: Response, next: NextFunction) {
  if (req.auth.businessId === null) {
    throw new HttpError(403, 'This route requires a business-scoped session, not a global-admin one')
  }
  req.businessId = req.auth.businessId
  next()
}
