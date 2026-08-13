import cors from 'cors'
import express from 'express'
import businessesRouter from './routes/businesses'
import clientsRouter from './routes/clients'
import projectsRouter from './routes/projects'
import { errorHandler } from './lib/http-error'
import { resolveBusiness } from './middleware/tenant'

export const app = express()

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

// Tenant management (create/list businesses) is admin-gated, not tenant-scoped — mounted
// ahead of resolveBusiness since it isn't acting "as" a business, it's managing them.
app.use('/api/businesses', businessesRouter)

app.use(resolveBusiness)
app.use('/api/projects', projectsRouter)
app.use('/api/clients', clientsRouter)

// Must be last: Express 5 forwards rejected promises from async route handlers here automatically.
app.use(errorHandler)
