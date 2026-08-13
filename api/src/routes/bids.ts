import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { bids, projects } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.projectId) {
    throw new HttpError(400, 'projectId is required')
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

export default router