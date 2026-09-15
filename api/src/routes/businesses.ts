import { Router } from 'express'
import { db } from '../db/index.js'
import { businesses, users } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { deprovisionBusiness, provisionBusiness } from '../lib/keycloak-admin.js'
import { requireGlobalAdmin } from '../middleware/globalAdmin.js'

// Tenant management — creating/looking up businesses themselves, not acting within one.
// Deliberately not mounted behind authenticate's requireBusinessContext (see app.ts); gated
// by requireGlobalAdmin instead, since this is a cross-tenant capability.
const router = Router()

router.use(requireGlobalAdmin)

router.get('/', async (req, res) => {
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      keycloakProvisionedAt: businesses.keycloakProvisionedAt,
      createdAt: businesses.createdAt,
    })
    .from(businesses)

  res.json(rows)
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.name || !body.ownerName || !body.ownerEmail) {
    throw new HttpError(400, 'name, ownerName, and ownerEmail are required')
  }

  // Generated up front (rather than left to Postgres's defaultRandom()) so the same id names
  // both the Keycloak group and the eventual businesses row.
  const businessId = crypto.randomUUID()

  // Keycloak first: a failure here leaves nothing in Postgres to clean up. If the Postgres
  // write below fails instead, we compensate by deprovisioning what we just created — this is
  // a saga, not a distributed transaction (see plan doc's "known limitations").
  const { keycloakUserId, temporaryPassword } = await provisionBusiness(businessId, {
    name: body.ownerName,
    email: body.ownerEmail,
  })

  try {
    const { business, owner } = await db.transaction(async (tx) => {
      const [business] = await tx
        .insert(businesses)
        .values({ id: businessId, name: body.name, keycloakProvisionedAt: new Date() })
        .returning()

      const [owner] = await tx
        .insert(users)
        .values({
          businessId,
          userType: 'business',
          role: 'owner',
          name: body.ownerName,
          email: body.ownerEmail,
          keycloakUserId,
        })
        .returning()

      return { business, owner }
    })

    res.status(201).json({ business, ownerUser: owner, temporaryPassword, loginUrl: '/auth/login' })
  } catch (err) {
    await deprovisionBusiness(businessId, keycloakUserId)
    throw err
  }
})

export default router