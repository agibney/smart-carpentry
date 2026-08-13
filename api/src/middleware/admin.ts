import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../lib/http-error'

/**
 * Gates business-management routes (create/list tenants) — a different boundary than
 * X-Business-Id/DEFAULT_BUSINESS_ID (see middleware/tenant.ts), which only says "act as
 * this business" and shouldn't be enough to create new ones. No admin accounts exist yet,
 * so this is a shared secret for now — swap for a real admin-role check once login exists.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!process.env.ADMIN_API_KEY) {
    throw new HttpError(500, 'ADMIN_API_KEY is not configured')
  }

  if (req.header('X-Admin-Key') !== process.env.ADMIN_API_KEY) {
    throw new HttpError(401, 'Invalid or missing X-Admin-Key')
  }

  next()
}