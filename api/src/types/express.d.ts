// Populated by src/middleware/auth.ts (authenticate) and src/middleware/auth.ts
// (requireBusinessContext) before any route handler runs.
declare global {
  namespace Express {
    interface Request {
      // Non-null by the time any route handler runs — requireBusinessContext (mounted ahead
      // of every tenant-scoped router, see app.ts) rejects requests where auth.businessId is
      // null before assigning it here, so this keeps the same "always a real id" contract
      // every route already relies on (see api/src/lib/tenant.ts scopedTo). For the raw,
      // possibly-null value (e.g. to tell a global-admin request apart from a business one,
      // as businesses.ts's requireGlobalAdmin does), read req.auth.businessId instead.
      businessId: string
      auth: {
        sub: string
        roles: string[]
        // null for a global-admin user (no business group membership).
        businessId: string | null
      }
    }
  }
}

export {}