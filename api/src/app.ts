import cors from 'cors'
import express from 'express'
import clientsRouter from './routes/clients'
import projectsRouter from './routes/projects'
import { errorHandler } from './lib/http-error'

export const app = express()

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/projects', projectsRouter)
app.use('/api/clients', clientsRouter)

// Must be last: Express 5 forwards rejected promises from async route handlers here automatically.
app.use(errorHandler)
