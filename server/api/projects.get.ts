import { db } from '../db'
import { projects } from '../db/schema'

export default defineEventHandler(async () => {
  return await db.select().from(projects)
})