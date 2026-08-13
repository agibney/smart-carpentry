import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.js'
import { attachments, projects } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

const router = Router()

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.projectId || !body.type || !body.storageKey) {
    throw new HttpError(400, 'projectId, type, and storageKey are required')
  }

  // projectId is caller-supplied — without this check a request could link an attachment to
  // another business's project, leaking it into that project's attachment list. Same guard
  // as projects.ts's clientId check.
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, req.businessId, eq(projects.id, body.projectId)),
  })

  if (!project) {
    throw new HttpError(400, 'Invalid projectId')
  }

  // storageKey is expected to point at an object already uploaded to private storage via a
  // signed URL (see CLAUDE.md convention — private storage, signed URLs only, no public
  // links). No upload/signing endpoint exists yet, so this only records the pointer —
  // the caller is responsible for having actually put the object there first.
  const [attachment] = await db
    .insert(attachments)
    .values({
      businessId: req.businessId,
      projectId: body.projectId,
      type: body.type,
      storageKey: body.storageKey,
      caption: body.caption || null,
    })
    .returning()

  res.status(201).json(attachment)
})

export default router