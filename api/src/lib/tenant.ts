import { and, eq, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Every business-owned table (see docs/requirements.md — "multi-tenant from the start")
 * carries a business_id column. Route handlers build their WHERE clauses through this
 * helper instead of hand-rolling eq(table.businessId, req.businessId) — one shared call
 * site is easier to audit than remembering the filter in every route, and a missed filter
 * here is a cross-tenant data leak, not just a bug.
 *
 * Usage: db.select().from(projects).where(scopedTo(projects.businessId, req.businessId))
 * or with extra conditions: scopedTo(projects.businessId, req.businessId, eq(projects.id, id))
 */
export function scopedTo(businessIdColumn: AnyPgColumn, businessId: string, ...rest: (SQL | undefined)[]): SQL {
  return and(eq(businessIdColumn, businessId), ...rest)!
}