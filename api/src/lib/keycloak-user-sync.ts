import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

type TokenClaims = {
  name?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  email?: string
}

/**
 * Keeps `users` as a queryable local mirror of Keycloak identities, without a separate manual
 * "create global user" / "create business user" step for every account Keycloak already
 * knows about. Called by src/middleware/auth.ts after every successful token verification.
 *
 * Business-owner users created through POST /api/businesses (see routes/businesses.ts) are
 * inserted eagerly at creation time and already carry keycloakUserId, so this is a no-op for
 * them — it only fires for accounts this app has never seen a token from before (e.g. an
 * `employee` added directly in Keycloak, or the seeded realm-import users).
 */
export async function provisionUserFromToken(params: {
  sub: string
  businessId: string | null
  roles: string[]
  claims: TokenClaims
}) {
  const { sub, businessId, roles, claims } = params

  const existing = await db.query.users.findFirst({
    where: eq(users.keycloakUserId, sub),
  })

  if (existing) {
    // Defense in depth: a token's business-group claim should always agree with the users
    // row it was originally provisioned under. Disagreement means the row was reassigned by
    // hand or the group membership changed out from under it — surface that as "no access"
    // rather than silently trusting whichever one the caller supplies.
    if (existing.businessId !== businessId) {
      throw new Error(`Token businessId (${businessId}) does not match users row businessId (${existing.businessId}) for subject ${sub}`)
    }
    return existing
  }

  const fullName = [claims.given_name, claims.family_name].filter(Boolean).join(' ')
  const name = claims.name ?? (fullName || claims.preferred_username) ?? 'Unknown'

  const [created] = await db
    .insert(users)
    .values({
      businessId,
      userType: businessId ? 'business' : 'global',
      role: roles.includes('owner') ? 'owner' : roles.includes('global-admin') ? 'global-admin' : roles.includes('employee') ? 'employee' : null,
      name,
      email: claims.email ?? null,
      keycloakUserId: sub,
    })
    .returning()

  return created
}
