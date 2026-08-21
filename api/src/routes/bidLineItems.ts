import { and, eq } from 'drizzle-orm'
import { Router, type Request } from 'express'
import { db } from '../db/index.js'
import { bidLineItems, bids, materials } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

// Mounted at /api/bids/:bidId/line-items (see app.ts) — mergeParams so req.params.bidId is
// visible here. bid_line_items has no business_id of its own (see CLAUDE.md — it's scoped
// transitively through its bid), so every route below confirms the bid is ours first and
// then operates scoped to that bid's id, rather than using scopedTo directly on this table.
const router = Router({ mergeParams: true })

// Express 5 infers req.params types from each route's own path literal (e.g. '/:id' below
// gives { id: string }), which has no way to see :bidId — that only exists in the mount
// path in app.ts, merged in at runtime by mergeParams but invisible to that inference.
function bidIdParam(req: Request): string {
  return (req.params as { bidId: string }).bidId
}

async function requireOwnedBid(businessId: string, bidId: string) {
  const bid = await db.query.bids.findFirst({
    where: scopedTo(bids.businessId, businessId, eq(bids.id, bidId)),
    columns: { id: true },
  })

  if (!bid) {
    throw new HttpError(404, 'Bid not found')
  }

  return bid
}

router.get('/', async (req, res) => {
  const bid = await requireOwnedBid(req.businessId, bidIdParam(req))

  res.json(await db.select().from(bidLineItems).where(eq(bidLineItems.bidId, bid.id)))
})

router.post('/', async (req, res) => {
  const bid = await requireOwnedBid(req.businessId, bidIdParam(req))
  const body = req.body ?? {}

  if (!body.description || body.quantity === undefined || body.unitPrice === undefined) {
    throw new HttpError(400, 'description, quantity, and unitPrice are required')
  }

  if (body.materialId) {
    // materialId is caller-supplied — without this check a request could link a line item
    // to another business's material, leaking that material's name/price into this bid's
    // line items via the relation. Same guard as bids.ts's projectId check.
    const material = await db.query.materials.findFirst({
      where: scopedTo(materials.businessId, req.businessId, eq(materials.id, body.materialId)),
    })

    if (!material) {
      throw new HttpError(400, 'Invalid materialId')
    }
  }

  const [lineItem] = await db
    .insert(bidLineItems)
    .values({
      bidId: bid.id,
      materialId: body.materialId || null,
      description: body.description,
      quantity: body.quantity,
      unit: body.unit || null,
      unitPrice: body.unitPrice,
      category: body.category || null,
    })
    .returning()

  res.status(201).json(lineItem)
})

router.patch('/:id', async (req, res) => {
  const bid = await requireOwnedBid(req.businessId, bidIdParam(req))
  const body = req.body ?? {}

  const updates: Partial<typeof bidLineItems.$inferInsert> = {}

  if ('description' in body) {
    if (!body.description) {
      throw new HttpError(400, 'description cannot be empty')
    }
    updates.description = body.description
  }

  if ('quantity' in body) {
    if (body.quantity === null) {
      throw new HttpError(400, 'quantity cannot be null')
    }
    updates.quantity = body.quantity
  }

  if ('unit' in body) {
    updates.unit = body.unit || null
  }

  if ('unitPrice' in body) {
    if (body.unitPrice === null) {
      throw new HttpError(400, 'unitPrice cannot be null')
    }
    updates.unitPrice = body.unitPrice
  }

  if ('category' in body) {
    updates.category = body.category || null
  }

  if ('materialId' in body) {
    if (body.materialId) {
      // Same guard as POST — confirm the material is ours before linking to it.
      const material = await db.query.materials.findFirst({
        where: scopedTo(materials.businessId, req.businessId, eq(materials.id, body.materialId)),
      })

      if (!material) {
        throw new HttpError(400, 'Invalid materialId')
      }
    }
    updates.materialId = body.materialId || null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped to this bid's id, not just the line item's own id — otherwise a line item that
  // exists but belongs to a different bid would still get updated before any check could
  // catch it (requireOwnedBid only confirms the bid in the URL, not this row's bid).
  const [lineItem] = await db
    .update(bidLineItems)
    .set(updates)
    .where(and(eq(bidLineItems.id, req.params.id), eq(bidLineItems.bidId, bid.id)))
    .returning()

  if (!lineItem) {
    throw new HttpError(404, 'Line item not found')
  }

  res.json(lineItem)
})

router.delete('/:id', async (req, res) => {
  const bid = await requireOwnedBid(req.businessId, bidIdParam(req))

  // Same scoping reasoning as PATCH above.
  const [lineItem] = await db
    .delete(bidLineItems)
    .where(and(eq(bidLineItems.id, req.params.id), eq(bidLineItems.bidId, bid.id)))
    .returning({ id: bidLineItems.id })

  if (!lineItem) {
    throw new HttpError(404, 'Line item not found')
  }

  res.status(204).send()
})

export default router
