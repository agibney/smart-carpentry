import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { projectSubcontractors, subcontractors } from '../db/schema.js'
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

router.patch('/:id', async (req, res) => {
  const body = req.body ?? {}

  // Same guard as POST — no encryption helper exists yet, so reject contact info outright
  // rather than writing plaintext into a column named like it's encrypted.
  if (body.phone) {
    throw new HttpError(400, 'Contact info (phone) is not supported yet — no encryption helper exists')
  }

  // No status field to target here (unlike bids/projects) — this patches whichever of the
  // subcontractor's own editable fields are supplied.
  const updates: Partial<typeof subcontractors.$inferInsert> = {}

  if ('name' in body) {
    if (!body.name) {
      throw new HttpError(400, 'name cannot be empty')
    }
    updates.name = body.name
  }

  if ('trade' in body) {
    updates.trade = body.trade || null
  }

  if ('rate' in body) {
    updates.rate = body.rate ?? null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped update-and-return in one query rather than fetch-then-update — the where clause
  // already guards against updating another business's subcontractor, so an empty result
  // here means not found (same 404 semantics as GET /:id).
  const [subcontractor] = await db
    .update(subcontractors)
    .set(updates)
    .where(scopedTo(subcontractors.businessId, req.businessId, eq(subcontractors.id, req.params.id)))
    .returning({
      id: subcontractors.id,
      name: subcontractors.name,
      trade: subcontractors.trade,
      rate: subcontractors.rate,
    })

  if (!subcontractor) {
    throw new HttpError(404, 'Subcontractor not found')
  }

  res.json(subcontractor)
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

router.delete('/:id', async (req, res) => {
  // Confirm the subcontractor is ours first (same guard as GET/PATCH /:id) — otherwise this
  // would leak whether a given subcontractor id exists, and its assignment status, to
  // another business.
  const subcontractor = await db.query.subcontractors.findFirst({
    where: scopedTo(subcontractors.businessId, req.businessId, eq(subcontractors.id, req.params.id)),
    columns: { id: true },
  })

  if (!subcontractor) {
    throw new HttpError(404, 'Subcontractor not found')
  }

  // project_subcontractors.subcontractorId has no cascade — deleting anyway would surface as
  // a raw Postgres FK violation. Check for an assignment first and return a clean 409 instead.
  const assignment = await db.query.projectSubcontractors.findFirst({
    where: eq(projectSubcontractors.subcontractorId, req.params.id),
    columns: { id: true },
  })

  if (assignment) {
    throw new HttpError(409, 'Subcontractor is assigned to a project and cannot be deleted')
  }

  await db.delete(subcontractors).where(eq(subcontractors.id, req.params.id))

  res.status(204).send()
})

export default router