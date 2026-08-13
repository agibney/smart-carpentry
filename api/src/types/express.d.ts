// Populated by src/middleware/tenant.ts before any route handler runs.
declare global {
  namespace Express {
    interface Request {
      businessId: string
    }
  }
}

export {}