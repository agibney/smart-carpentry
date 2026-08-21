import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { materials } from '../db/schema.js'
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

router.get('/:id', async (req, res) => {
  const material = await db.query.materials.findFirst({
    where: scopedTo(materials.businessId, req.businessId, eq(materials.id, req.params.id)),
  })

  if (!material) {
    throw new HttpError(404, 'Material not found')
  }

  res.json(material)
})

export default router
