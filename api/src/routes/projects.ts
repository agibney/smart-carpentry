import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { clients, PROJECT_STATUSES, projects } from '../db/schema.js'
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

  if (!body.status || !PROJECT_STATUSES.includes(body.status)) {
    throw new HttpError(400, `status must be one of: ${PROJECT_STATUSES.join(', ')}`)
  }

  // Scoped update-and-return in one query rather than fetch-then-update — the where clause
  // already guards against updating another business's project, so an empty result here
  // means not found (same 404 semantics as GET /:id).
  const [project] = await db
    .update(projects)
    .set({ status: body.status })
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
