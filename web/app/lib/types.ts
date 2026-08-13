// Hand-maintained copy of the api/ JSON response shapes — deliberately NOT imported from the
// API's Drizzle schema. Real API-contract practice means the client depends on the wire shape,
// not the ORM's internal types. Update this file on purpose whenever an API response changes.

export const PROJECT_STATUSES = ['lead', 'quoted', 'active', 'completed', 'cancelled'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export interface Client {
  id: string
  name: string
  notes: string | null
  createdAt: string
  // *Encrypted PII columns (phone/email/address) are intentionally omitted: the API never
  // serializes them (see CLAUDE.md convention).
}

export interface Project {
  id: string
  clientId: string
  title: string
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  description: string | null
  createdAt: string
}

export type ProjectWithClient = Project & { client: Client }

export interface CreateProjectInput {
  clientId: string
  title: string
  status?: ProjectStatus
  startDate?: string | null
  description?: string | null
}
