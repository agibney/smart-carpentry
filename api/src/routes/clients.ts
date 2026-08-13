import { Router } from 'express'
import { db } from '../db'
import { clients } from '../db/schema'

const router = Router()

router.get('/', async (req, res) => {
  // Never serialize the *Encrypted PII columns (see CLAUDE.md convention) — no encryption
  // helper exists yet, so nothing raw should ship to the browser at all.
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      notes: clients.notes,
      createdAt: clients.createdAt,
    })
    .from(clients)

  res.json(rows)
})

export default router
