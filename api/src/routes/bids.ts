import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { bidLineItems, BID_STATUSES, bids, projects } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.projectId) {
    throw new HttpError(400, 'projectId is required')
  }

  if (body.status !== undefined && !BID_STATUSES.includes(body.status)) {
    throw new HttpError(400, `status must be one of: ${BID_STATUSES.join(', ')}`)
  }

  // totalAmount is never caller-supplied — it's owned by a pure calculation function over
  // the bid's line items (see CLAUDE.md convention: bid math is deterministic code, never a
  // trusted stored/cached value or an agent's output). A new bid has no line items yet, so
  // it starts with no total; recalculation happens once line items exist, not here.
  if (body.totalAmount !== undefined) {
    throw new HttpError(400, 'totalAmount cannot be set directly — it is calculated from line items')
  }

  // projectId is caller-supplied — confirm it's actually ours first (same guard as
  // attachments.ts's projectId check and projects.ts's clientId check).
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, req.businessId, eq(projects.id, body.projectId)),
  })

  if (!project) {
    throw new HttpError(400, 'Invalid projectId')
  }

  const [bid] = await db
    .insert(bids)
    .values({
      businessId: req.businessId,
      projectId: body.projectId,
      status: body.status || 'draft',
    })
    .returning()

  res.status(201).json(bid)
})

router.patch('/:id', async (req, res) => {
  const body = req.body ?? {}

  if (!body.status || !BID_STATUSES.includes(body.status)) {
    throw new HttpError(400, `status must be one of: ${BID_STATUSES.join(', ')}`)
  }

  // Scoped update-and-return in one query rather than fetch-then-update — the where clause
  // already guards against updating another business's bid, so an empty result here means
  // not found (same 404 semantics as GET /:id).
  const [bid] = await db
    .update(bids)
    .set({ status: body.status })
    .where(scopedTo(bids.businessId, req.businessId, eq(bids.id, req.params.id)))
    .returning()

  if (!bid) {
    throw new HttpError(404, 'Bid not found')
  }

  res.json(bid)
})

router.get('/:id', async (req, res) => {
  const bid = await db.query.bids.findFirst({
    where: scopedTo(bids.businessId, req.businessId, eq(bids.id, req.params.id)),
    with: { lineItems: true },
  })

  if (!bid) {
    throw new HttpError(404, 'Bid not found')
  }

  res.json(bid)
})

router.delete('/:id', async (req, res) => {
  // Confirm the bid is ours first (same guard as GET/PATCH /:id).
  const bid = await db.query.bids.findFirst({
    where: scopedTo(bids.businessId, req.businessId, eq(bids.id, req.params.id)),
    columns: { id: true },
  })

  if (!bid) {
    throw new HttpError(404, 'Bid not found')
  }

  // Unlike DELETE /api/projects/:id and /api/subcontractors/:id, this doesn't block on
  // dependents: bid_line_items has no business_id of its own and is scoped transitively
  // through its bid (see CLAUDE.md) — it's a child of the bid, not an independent record
  // worth protecting, so it's deleted along with it rather than blocking the request.
  await db.transaction(async (tx) => {
    await tx.delete(bidLineItems).where(eq(bidLineItems.bidId, req.params.id))
    await tx.delete(bids).where(eq(bids.id, req.params.id))
  })

  res.status(204).send()
})

export default router
