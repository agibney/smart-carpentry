import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { USER_TYPES, users } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { requireAdmin } from '../middleware/admin.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.get('/', async (req, res) => {
  // scopedTo's eq(businessId, req.businessId) naturally excludes global users (businessId
  // is null there, which never equals a real id) — no special-casing needed to keep this
  // list to the current tenant's own business users.
  res.json(await db.select().from(users).where(scopedTo(users.businessId, req.businessId)))
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.name) {
    throw new HttpError(400, 'name is required')
  }

  const userType = body.userType || 'business'

  if (!USER_TYPES.includes(userType)) {
    throw new HttpError(400, `userType must be one of: ${USER_TYPES.join(', ')}`)
  }

  let businessId: string | null = req.businessId

  if (userType === 'global') {
    // A global user isn't scoped to any business — creating one needs the same admin
    // boundary as creating a business itself (see businesses.ts), not just "act as this
    // tenant" (X-Business-Id). Reused directly rather than mounting requireAdmin for the
    // whole router, since only this one branch needs it — a synchronous throw here
    // rejects this async handler's promise, which Express 5 forwards to errorHandler same
    // as any other thrown HttpError (see app.ts).
    //
    // Known quirk: this route still sits behind resolveBusiness (app.ts), so even a
    // global-user request must resolve *some* valid business context to get this far —
    // harmless for V1 since DEFAULT_BUSINESS_ID always provides one, but worth knowing if
    // this route ever moves ahead of resolveBusiness like businesses.ts did.
    requireAdmin(req, res, () => {})
    businessId = null
  }

  const [user] = await db
    .insert(users)
    .values({
      businessId,
      userType,
      name: body.name,
      role: body.role || null,
      email: body.email || null,
      preferredLanguage: body.preferredLanguage || null,
    })
    .returning()

  res.status(201).json(user)
})

router.patch('/:id', async (req, res) => {
  const body = req.body ?? {}

  // Changing userType (or reassigning businessId) is the same sensitive move POST gates
  // behind requireAdmin — allowing it here would let a caller create a plain business user
  // with no admin key, then PATCH it to global and bypass that gate entirely. Simplest safe
  // answer for now: not supported via PATCH at all, business-scoped only (see GET /:id).
  if (body.userType !== undefined || body.businessId !== undefined) {
    throw new HttpError(400, 'userType and businessId cannot be changed via PATCH')
  }

  const updates: Partial<typeof users.$inferInsert> = {}

  if ('name' in body) {
    if (!body.name) {
      throw new HttpError(400, 'name cannot be empty')
    }
    updates.name = body.name
  }

  if ('role' in body) {
    updates.role = body.role || null
  }

  if ('email' in body) {
    updates.email = body.email || null
  }

  if ('preferredLanguage' in body) {
    updates.preferredLanguage = body.preferredLanguage || null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped update-and-return in one query rather than fetch-then-update — the where clause
  // already guards against updating another business's user (and, same as GET /:id,
  // against a global one), so an empty result here means not found.
  const [user] = await db
    .update(users)
    .set(updates)
    .where(scopedTo(users.businessId, req.businessId, eq(users.id, req.params.id)))
    .returning()

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  res.json(user)
})

router.get('/:id', async (req, res) => {
  // Business-scoped users only, same as GET / — fetching a global user isn't supported by
  // this route yet (no admin read surface exists for it, matching how there's no real
  // auth/admin surface yet at all).
  const user = await db.query.users.findFirst({
    where: scopedTo(users.businessId, req.businessId, eq(users.id, req.params.id)),
  })

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  res.json(user)
})

router.delete('/:id', async (req, res) => {
  // Business-scoped only, same boundary as GET/PATCH /:id — deleting a global user isn't
  // supported by this route yet, same reasoning as those.
  const user = await db.query.users.findFirst({
    where: scopedTo(users.businessId, req.businessId, eq(users.id, req.params.id)),
    columns: { id: true },
  })

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  // Nothing references users.id yet — safe to delete outright, same as
  // DELETE /api/attachments/:id.
  await db.delete(users).where(eq(users.id, req.params.id))

  res.status(204).send()
})

export default router
