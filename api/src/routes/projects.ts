import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { attachments, clients, PROJECT_STATUSES, projects } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.get('/', async (req, res) => {
  res.json(await db.select().from(projects).where(scopedTo(projects.businessId, req.businessId)))
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.clientId || !body.title) {
    throw new HttpError(400, 'clientId and title are required')
  }

  if (body.status !== undefined && !PROJECT_STATUSES.includes(body.status)) {
    throw new HttpError(400, `status must be one of: ${PROJECT_STATUSES.join(', ')}`)
  }

  // clientId is caller-supplied — without this check a request could link a project to
  // another business's client id, which would leak that client's data into this business's
  // project views via the client relation. Confirm the client is actually ours first.
  const client = await db.query.clients.findFirst({
    where: scopedTo(clients.businessId, req.businessId, eq(clients.id, body.clientId)),
  })

  if (!client) {
    throw new HttpError(400, 'Invalid clientId')
  }

  const [project] = await db
    .insert(projects)
    .values({
      businessId: req.businessId,
      clientId: body.clientId,
      title: body.title,
      status: body.status || 'lead',
      startDate: body.startDate || null,
      description: body.description || null,
    })
    .returning()

  res.status(201).json(project)
})

router.patch('/:id', async (req, res) => {
  const body = req.body ?? {}

  // clientId isn't editable here — reassigning a project to a different client is a bigger,
  // more deliberate move than a field edit, same reasoning as bids.ts not letting PATCH
  // touch projectId or projectSubcontractors.ts not letting it touch subcontractorId.
  if (body.clientId !== undefined) {
    throw new HttpError(400, 'clientId cannot be changed via PATCH')
  }

  const updates: Partial<typeof projects.$inferInsert> = {}

  if ('status' in body) {
    if (!body.status || !PROJECT_STATUSES.includes(body.status)) {
      throw new HttpError(400, `status must be one of: ${PROJECT_STATUSES.join(', ')}`)
    }
    updates.status = body.status
  }

  if ('title' in body) {
    if (!body.title) {
      throw new HttpError(400, 'title cannot be empty')
    }
    updates.title = body.title
  }

  if ('description' in body) {
    updates.description = body.description || null
  }

  if ('startDate' in body) {
    updates.startDate = body.startDate || null
  }

  if ('endDate' in body) {
    updates.endDate = body.endDate || null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped update-and-return in one query rather than fetch-then-update — the where clause
  // already guards against updating another business's project, so an empty result here
  // means not found (same 404 semantics as GET /:id).
  const [project] = await db
    .update(projects)
    .set(updates)
    .where(scopedTo(projects.businessId, req.businessId, eq(projects.id, req.params.id)))
    .returning()

  if (!project) {
    throw new HttpError(404, 'Project not found')
  }

  res.json(project)
})

router.get('/:id', async (req, res) => {
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, req.businessId, eq(projects.id, req.params.id)),
    with: {
      // Never serialize the client's *Encrypted PII columns (see CLAUDE.md convention) —
      // no encryption helper exists yet, so nothing raw should ship to the browser at all.
      client: {
        columns: {
          phoneEncrypted: false,
          emailEncrypted: false,
          addressEncrypted: false,
        },
      },
    },
  })

  if (!project) {
    throw new HttpError(404, 'Project not found')
  }

  res.json(project)
})

router.get('/:id/bids', async (req, res) => {
  // Confirm the project is ours first (same guard as GET /:id) — otherwise this would leak
  // whether a given project id exists, and its bids, to another business.
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, req.businessId, eq(projects.id, req.params.id)),
    with: { bids: true },
  })

  if (!project) {
    throw new HttpError(404, 'Project not found')
  }

  res.json(project.bids)
})

router.get('/:id/attachments', async (req, res) => {
  // Confirm the project is ours first (same guard as GET /:id/bids) — otherwise this would
  // leak whether a given project id exists, and its attachments, to another business.
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, req.businessId, eq(projects.id, req.params.id)),
    with: { attachments: true },
  })

  if (!project) {
    throw new HttpError(404, 'Project not found')
  }

  res.json(project.attachments)
})

router.patch('/:id/attachments/:attachmentId', async (req, res) => {
  const body = req.body ?? {}

  // scrubStatus/validatedAt are meant to be set by the (not-yet-built) upload pipeline —
  // client-side blur, server validation, server-side blur, internal validation — described
  // in docs/PhotoBlurDesign.excalidraw, not supplied directly by whoever's calling this
  // route. Accepting them here would let a caller just claim "validated" without the photo
  // ever actually going through scrubbing, defeating the point of those columns. Same
  // discipline as bids.ts rejecting a caller-supplied totalAmount.
  if (body.scrubStatus !== undefined || body.validatedAt !== undefined) {
    throw new HttpError(400, 'scrubStatus and validatedAt are set by the scrubbing pipeline, not directly')
  }

  const updates: Partial<typeof attachments.$inferInsert> = {}

  if ('type' in body) {
    if (!body.type) {
      throw new HttpError(400, 'type cannot be empty')
    }
    updates.type = body.type
  }

  if ('storageKey' in body) {
    if (!body.storageKey) {
      throw new HttpError(400, 'storageKey cannot be empty')
    }
    updates.storageKey = body.storageKey
  }

  if ('caption' in body) {
    updates.caption = body.caption || null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped by business, the attachment's own id, and this URL's project id together — the
  // last one so an attachment that exists but belongs to a different project can't be
  // edited through the wrong project's URL (same isolation fix applied to bidLineItems.ts
  // and projectSubcontractors.ts).
  const [attachment] = await db
    .update(attachments)
    .set(updates)
    .where(
      scopedTo(
        attachments.businessId,
        req.businessId,
        eq(attachments.id, req.params.attachmentId),
        eq(attachments.projectId, req.params.id),
      ),
    )
    .returning()

  if (!attachment) {
    throw new HttpError(404, 'Attachment not found')
  }

  res.json(attachment)
})

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
  // Same scoping reasoning as PATCH above.
  const [attachment] = await db
    .delete(attachments)
    .where(
      scopedTo(
        attachments.businessId,
        req.businessId,
        eq(attachments.id, req.params.attachmentId),
        eq(attachments.projectId, req.params.id),
      ),
    )
    .returning({ id: attachments.id })

  if (!attachment) {
    throw new HttpError(404, 'Attachment not found')
  }

  // Same gap as DELETE /api/attachments/:id: only removes the DB pointer, not the
  // underlying object in private storage — no storage delete helper exists yet.
  res.status(204).send()
})

router.delete('/:id', async (req, res) => {
  // Confirm the project is ours first (same guard as GET /:id), and pull just enough of each
  // dependent relation to check for blockers in the same query — bids.projectId,
  // project_subcontractors.projectId, and attachments.projectId all reference projects with
  // no cascade, so deleting anyway would surface as a raw Postgres FK violation.
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, req.businessId, eq(projects.id, req.params.id)),
    with: {
      bids: { columns: { id: true } },
      subcontractors: { columns: { id: true } },
      attachments: { columns: { id: true } },
    },
  })

  if (!project) {
    throw new HttpError(404, 'Project not found')
  }

  const blockers = [
    project.bids.length > 0 && 'bids',
    project.subcontractors.length > 0 && 'subcontractor assignments',
    project.attachments.length > 0 && 'attachments',
  ].filter(Boolean)

  if (blockers.length > 0) {
    throw new HttpError(409, `Project has ${blockers.join(', ')} and cannot be deleted`)
  }

  await db.delete(projects).where(eq(projects.id, req.params.id))

  res.status(204).send()
})

export default router
