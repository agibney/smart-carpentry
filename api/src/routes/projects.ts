import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db'
import { clients, projects } from '../db/schema'
import { HttpError } from '../lib/http-error'
import { scopedTo } from '../lib/tenant'

const router = Router()

router.get('/', async (req, res) => {
  res.json(await db.select().from(projects).where(scopedTo(projects.businessId, req.businessId)))
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.clientId || !body.title) {
    throw new HttpError(400, 'clientId and title are required')
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

export default router
