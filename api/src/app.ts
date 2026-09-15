import cors from 'cors'
import express from 'express'
import attachmentsRouter from './routes/attachments.js'
import bidLineItemsRouter from './routes/bidLineItems.js'
import bidsRouter from './routes/bids.js'
import businessesRouter from './routes/businesses.js'
import clientsRouter from './routes/clients.js'
import materialsRouter from './routes/materials.js'
import projectsRouter from './routes/projects.js'
import projectSubcontractorsRouter from './routes/projectSubcontractors.js'
import subcontractorsRouter from './routes/subcontractors.js'
import usersRouter from './routes/users.js'
import { errorHandler } from './lib/http-error.js'
import { authenticate, requireBusinessContext } from './middleware/auth.js'

export const app = express()

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

// Every route needs some verified identity, so authenticate runs before anything else —
// unlike the old resolveBusiness, which /api/businesses was mounted ahead of on purpose.
app.use(authenticate)

// Tenant management (create/list businesses) is admin-gated, not tenant-scoped — mounted
// ahead of requireBusinessContext since it isn't acting "as" a business, it's managing them.
app.use('/api/businesses', businessesRouter)

app.use(requireBusinessContext)
app.use('/api/projects', projectsRouter)
// Nested under its parent project, same reasoning as /api/bids/:bidId/line-items below —
// project_subcontractors has no business_id of its own (see routes/projectSubcontractors.ts).
app.use('/api/projects/:projectId/subcontractors', projectSubcontractorsRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/materials', materialsRouter)
app.use('/api/subcontractors', subcontractorsRouter)
app.use('/api/attachments', attachmentsRouter)
app.use('/api/bids', bidsRouter)
// Nested under its parent bid rather than a top-level /api/bid-line-items — line items have
// no business_id of their own (see routes/bidLineItems.ts), so the URL itself carries the
// bid context the route needs to scope through.
app.use('/api/bids/:bidId/line-items', bidLineItemsRouter)
// users is mounted here (tenant-scoped, like everything else on this side of resolveBusiness)
// even though it also handles global-user creation — that branch is admin-gated inline
// rather than by moving the whole router ahead of resolveBusiness, since business-user
// creation still needs the tenant context (see routes/users.ts).
app.use('/api/users', usersRouter)

// Must be last: Express 5 forwards rejected promises from async route handlers here automatically.
app.use(errorHandler)
