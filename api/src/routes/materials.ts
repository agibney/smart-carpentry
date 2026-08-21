import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { bidLineItems, materials } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.get('/', async (req, res) => {
  res.json(await db.select().from(materials).where(scopedTo(materials.businessId, req.businessId)))
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.name) {
    throw new HttpError(400, 'name is required')
  }

  // cachedPrice/priceUpdatedAt are meant to move together — a price the caller supplies now
  // is "fresh" as of now, not whenever this row happens to get read.
  const [material] = await db
    .insert(materials)
    .values({
      businessId: req.businessId,
      name: body.name,
      source: body.source || null,
      unit: body.unit || null,
      cachedPrice: body.cachedPrice ?? null,
      priceUpdatedAt: body.cachedPrice !== undefined ? new Date() : null,
    })
    .returning()

  res.status(201).json(material)
})

router.patch('/:id', async (req, res) => {
  const body = req.body ?? {}

  const updates: Partial<typeof materials.$inferInsert> = {}

  if ('name' in body) {
    if (!body.name) {
      throw new HttpError(400, 'name cannot be empty')
    }
    updates.name = body.name
  }

  if ('source' in body) {
    updates.source = body.source || null
  }

  if ('unit' in body) {
    updates.unit = body.unit || null
  }

  if ('cachedPrice' in body) {
    // Same pairing as POST — an explicit price change is "fresh" as of now.
    updates.cachedPrice = body.cachedPrice ?? null
    updates.priceUpdatedAt = body.cachedPrice != null ? new Date() : null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped update-and-return in one query rather than fetch-then-update — the where clause
  // already guards against updating another business's material, so an empty result here
  // means not found (same 404 semantics as GET /:id).
  const [material] = await db
    .update(materials)
    .set(updates)
    .where(scopedTo(materials.businessId, req.businessId, eq(materials.id, req.params.id)))
    .returning()

  if (!material) {
    throw new HttpError(404, 'Material not found')
  }

  res.json(material)
})

router.get('/:id', async (req, res) => {
  const material = await db.query.materials.findFirst({
    where: scopedTo(materials.businessId, req.businessId, eq(materials.id, req.params.id)),
  })

  if (!material) {
    throw new HttpError(404, 'Material not found')
  }

  res.json(material)
})

router.delete('/:id', async (req, res) => {
  // Confirm the material is ours first (same guard as GET/PATCH /:id).
  const material = await db.query.materials.findFirst({
    where: scopedTo(materials.businessId, req.businessId, eq(materials.id, req.params.id)),
    columns: { id: true },
  })

  if (!material) {
    throw new HttpError(404, 'Material not found')
  }

  // bid_line_items.material_id is nullable specifically so a line item can stand alone
  // without a catalog reference (see schema.ts) — a line item already stores its own
  // description/quantity/unitPrice independently, so severing the link here doesn't lose
  // any bid data. Set-null instead of blocking, unlike DELETE /api/projects/:id and
  // /api/subcontractors/:id, which protect independent records the deletion would orphan.
  await db.transaction(async (tx) => {
    await tx.update(bidLineItems).set({ materialId: null }).where(eq(bidLineItems.materialId, req.params.id))
    await tx.delete(materials).where(eq(materials.id, req.params.id))
  })

  res.status(204).send()
})

export default router
