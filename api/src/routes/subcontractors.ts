import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { subcontractors } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.get('/', async (req, res) => {
  // Never serialize the *Encrypted PII columns (see CLAUDE.md convention) — no encryption
  // helper exists yet, so nothing raw should ship to the browser at all.
  const rows = await db
    .select({
      id: subcontractors.id,
      name: subcontractors.name,
      trade: subcontractors.trade,
      rate: subcontractors.rate,
    })
    .from(subcontractors)
    .where(scopedTo(subcontractors.businessId, req.businessId))

  res.json(rows)
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.name) {
    throw new HttpError(400, 'name is required')
  }

  // The *Encrypted columns need real encryption before they can hold anything (see CLAUDE.md
  // convention) — no helper exists yet, so reject contact info outright rather than either
  // writing plaintext into a column named like it's encrypted, or silently dropping data the
  // caller thinks was saved.
  if (body.phone) {
    throw new HttpError(400, 'Contact info (phone) is not supported yet — no encryption helper exists')
  }

  const [subcontractor] = await db
    .insert(subcontractors)
    .values({
      businessId: req.businessId,
      name: body.name,
      trade: body.trade || null,
      rate: body.rate ?? null,
    })
    .returning({
      id: subcontractors.id,
      name: subcontractors.name,
      trade: subcontractors.trade,
      rate: subcontractors.rate,
    })

  res.status(201).json(subcontractor)
})

router.get('/:id', async (req, res) => {
  // Never serialize the *Encrypted PII columns (see CLAUDE.md convention) — no encryption
  // helper exists yet, so nothing raw should ship to the browser at all.
  const subcontractor = await db
    .select({
      id: subcontractors.id,
      name: subcontractors.name,
      trade: subcontractors.trade,
      rate: subcontractors.rate,
    })
    .from(subcontractors)
    .where(scopedTo(subcontractors.businessId, req.businessId, eq(subcontractors.id, req.params.id)))
    .then((rows) => rows[0])

  if (!subcontractor) {
    throw new HttpError(404, 'Subcontractor not found')
  }

  res.json(subcontractor)
})

export default router