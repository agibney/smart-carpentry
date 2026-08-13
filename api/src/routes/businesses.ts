import { Router } from 'express'
import { db } from '../db/index.js'
import { businesses } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { requireAdmin } from '../middleware/admin.js'

// Tenant management — creating/looking up businesses themselves, not acting within one.
// Deliberately not mounted behind the tenant-resolving middleware (see app.ts); gated by
// requireAdmin instead.
const router = Router()

router.use(requireAdmin)

router.get('/', async (req, res) => {
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      createdAt: businesses.createdAt,
    })
    .from(businesses)

  res.json(rows)
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.name) {
    throw new HttpError(400, 'name is required')
  }

  const [business] = await db.insert(businesses).values({ name: body.name }).returning()

  res.status(201).json(business)
})

export default router