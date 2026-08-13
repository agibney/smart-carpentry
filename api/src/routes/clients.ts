import { Router } from 'express'
import { db } from '../db/index.js'
import { clients } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'
import { scopedTo } from '../lib/tenant.js'

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
    .where(scopedTo(clients.businessId, req.businessId))

  res.json(rows)
})

router.post('/', async (req, res) => {
  const body = req.body ?? {}

  if (!body.name) {
    throw new HttpError(400, 'name is required')
  }

  // The *Encrypted columns need real encryption before they can hold anything (see CLAUDE.md
  // convention) — no helper exists yet, so reject contact info outright rather than either
  // writing plaintext into a column named like it's encrypted, or silently dropping data the
  // caller thinks was saved.
  if (body.phone || body.email || body.address) {
    throw new HttpError(400, 'Contact info (phone/email/address) is not supported yet — no encryption helper exists')
  }

  const [client] = await db
    .insert(clients)
    .values({
      businessId: req.businessId,
      name: body.name,
      notes: body.notes || null,
    })
    .returning({
      id: clients.id,
      name: clients.name,
      notes: clients.notes,
      createdAt: clients.createdAt,
    })

  res.status(201).json(client)
})

export default router
