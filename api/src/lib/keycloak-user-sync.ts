import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { HttpError } from './http-error.js'

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
    // hand or the group membership changed out from under it — surface that as a clean 403,
    // same as any other authorization failure this app returns, rather than a raw 500.
    if (existing.businessId !== businessId) {
      throw new HttpError(403, 'Token business membership does not match this account’s existing record')
    }
    return existing
  }

  const fullName = [claims.given_name, claims.family_name].filter(Boolean).join(' ')
  const name = claims.name ?? (fullName || claims.preferred_username) ?? 'Unknown'

  try {
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
  } catch (err) {
    // Race: two requests from the same brand-new Keycloak identity's first-ever token can
    // both reach here before either commits. keycloakUserId is unique at the DB level, so
    // the loser hits a unique-violation (Postgres SQLSTATE 23505) instead of a clean
    // check-then-insert — re-fetch and return the winner's row rather than 500ing.
    if ((err as { code?: string }).code === '23505') {
      const winner = await db.query.users.findFirst({ where: eq(users.keycloakUserId, sub) })
      if (winner) return winner
    }
    throw err
  }
}
