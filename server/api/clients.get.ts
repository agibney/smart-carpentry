import { db } from '../db'
import { clients } from '../db/schema'

export default defineEventHandler(async () => {
  return await db.select().from(clients)
})
