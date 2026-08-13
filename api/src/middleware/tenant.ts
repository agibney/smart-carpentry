import type { NextFunction, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { businesses } from '../db/schema.js'
import { HttpError } from '../lib/http-error.js'

/**
 * Resolves req.businessId for every request before it reaches a route handler.
 *
 * There's no login system yet (see docs/requirements.md — auth is a later pass), so for
 * now the business is either named explicitly via an X-Business-Id header, or falls back
 * to DEFAULT_BUSINESS_ID (the single business seeded by migrations/0001_add_multi_tenancy.sql,
 * matching V1's single-business usage). The id is validated against the businesses table
 * on every request — cheap at this scale, and it turns a typo'd/stale id into a clear 400
 * instead of routes silently scoping to nothing and looking like empty data.
 *
 * When real auth lands, this middleware is the only place that needs to change: it swaps
 * the header/env lookup for a session lookup, and every route downstream keeps working
 * unmodified since they only ever consume req.businessId.
 */
export async function resolveBusiness(req: Request, res: Response, next: NextFunction) {
  const businessId = req.header('X-Business-Id') ?? process.env.DEFAULT_BUSINESS_ID

  if (!businessId) {
    throw new HttpError(400, 'Business context is required (X-Business-Id header or DEFAULT_BUSINESS_ID)')
  }

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
  })

  if (!business) {
    throw new HttpError(400, `Unknown business: ${businessId}`)
  }

  req.businessId = business.id
  next()
}