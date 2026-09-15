import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../lib/http-error.js'

/**
 * Gates business-management routes (create/list tenants) — a different boundary than
 * req.businessId (see middleware/auth.ts), which only says "act as this business" and
 * shouldn't be enough to create new ones. Replaces the old shared-secret requireAdmin
 * (middleware/admin.ts, deleted) now that real login exists: this checks the `global-admin`
 * realm role on the verified token instead of an X-Admin-Key header.
 */
export function requireGlobalAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.roles.includes('global-admin')) {
    throw new HttpError(403, 'Requires the global-admin role')
  }
  next()
}