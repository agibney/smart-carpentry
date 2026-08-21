import { and, eq } from 'drizzle-orm'
import { Router, type Request } from 'express'
import { db } from '../db/index.js'
import { projects, projectSubcontractors, subcontractors } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

// Mounted at /api/projects/:projectId/subcontractors (see app.ts) — mergeParams so
// req.params.projectId is visible here. project_subcontractors has no business_id of its
// own (see CLAUDE.md — it's scoped transitively through its project), so every route below
// confirms the project is ours first and then operates scoped to that project's id, rather
// than using scopedTo directly on this table.
const router = Router({ mergeParams: true })

// Express 5 infers req.params types from each route's own path literal, which has no way to
// see :projectId — that only exists in the mount path in app.ts, merged in at runtime by
// mergeParams but invisible to that inference (same as bidLineItems.ts's bidIdParam).
function projectIdParam(req: Request): string {
  return (req.params as { projectId: string }).projectId
}

async function requireOwnedProject(businessId: string, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: scopedTo(projects.businessId, businessId, eq(projects.id, projectId)),
    columns: { id: true },
  })

  if (!project) {
    throw new HttpError(404, 'Project not found')
  }

  return project
}

router.get('/', async (req, res) => {
  const project = await requireOwnedProject(req.businessId, projectIdParam(req))

  res.json(
    await db.select().from(projectSubcontractors).where(eq(projectSubcontractors.projectId, project.id)),
  )
})

router.post('/', async (req, res) => {
  const project = await requireOwnedProject(req.businessId, projectIdParam(req))
  const body = req.body ?? {}

  if (!body.subcontractorId) {
    throw new HttpError(400, 'subcontractorId is required')
  }

  // subcontractorId is caller-supplied — without this check a request could link this
  // assignment to another business's subcontractor. Same guard as bidLineItems.ts's
  // materialId check and bids.ts's projectId check.
  const subcontractor = await db.query.subcontractors.findFirst({
    where: scopedTo(subcontractors.businessId, req.businessId, eq(subcontractors.id, body.subcontractorId)),
  })

  if (!subcontractor) {
    throw new HttpError(400, 'Invalid subcontractorId')
  }

  const [assignment] = await db
    .insert(projectSubcontractors)
    .values({
      projectId: project.id,
      subcontractorId: body.subcontractorId,
      role: body.role || null,
      agreedRate: body.agreedRate ?? null,
    })
    .returning()

  res.status(201).json(assignment)
})

router.patch('/:id', async (req, res) => {
  const project = await requireOwnedProject(req.businessId, projectIdParam(req))
  const body = req.body ?? {}

  // projectId/subcontractorId define which assignment this is — changing either would make
  // this a different assignment, not an edit of this one. Only its terms (role/agreedRate)
  // are editable, same reasoning as bids.ts's PATCH not touching projectId.
  if (body.projectId !== undefined || body.subcontractorId !== undefined) {
    throw new HttpError(400, 'projectId and subcontractorId cannot be changed via PATCH')
  }

  const updates: Partial<typeof projectSubcontractors.$inferInsert> = {}

  if ('role' in body) {
    updates.role = body.role || null
  }

  if ('agreedRate' in body) {
    updates.agreedRate = body.agreedRate ?? null
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No updatable fields provided')
  }

  // Scoped to this project's id, not just the assignment's own id — otherwise an assignment
  // that exists but belongs to a different project would still get updated before any check
  // could catch it (requireOwnedProject only confirms the project in the URL, not this
  // row's project). Same bug class fixed in bidLineItems.ts's PATCH/DELETE.
  const [assignment] = await db
    .update(projectSubcontractors)
    .set(updates)
    .where(and(eq(projectSubcontractors.id, req.params.id), eq(projectSubcontractors.projectId, project.id)))
    .returning()

  if (!assignment) {
    throw new HttpError(404, 'Assignment not found')
  }

  res.json(assignment)
})

router.delete('/:id', async (req, res) => {
  const project = await requireOwnedProject(req.businessId, projectIdParam(req))

  // Same scoping reasoning as PATCH above.
  const [assignment] = await db
    .delete(projectSubcontractors)
    .where(and(eq(projectSubcontractors.id, req.params.id), eq(projectSubcontractors.projectId, project.id)))
    .returning({ id: projectSubcontractors.id })

  if (!assignment) {
    throw new HttpError(404, 'Assignment not found')
  }

  res.status(204).send()
})

export default router
