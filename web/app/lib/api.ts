// Loader/action-facing API client — the only place the frontend talks to the api/ Express
// server. This is the analog of the old Nuxt composables, but it only ever runs server-side
// (inside RR7 loaders/actions), since framework-mode SSR resolves data before the browser
// gets involved.
import type { Business, Client, CreateBusinessInput, CreateProjectInput, Project, ProjectWithClient } from './types'

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Identity is carried entirely by the verified token — no X-Business-Id header. See
      // api/src/middleware/auth.ts, which derives business membership from the token's own
      // group claim instead of trusting anything the caller sends.
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Response(body.error ?? res.statusText, { status: res.status })
  }

  return res.json()
}

export const getProjects = (accessToken: string) => apiFetch<Project[]>('/api/projects', accessToken)

export const getProject = (accessToken: string, id: string) => apiFetch<ProjectWithClient>(`/api/projects/${id}`, accessToken)

export const createProject = (accessToken: string, input: CreateProjectInput) =>
  apiFetch<Project>('/api/projects', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const getClients = (accessToken: string) => apiFetch<Client[]>('/api/clients', accessToken)

// Global-admin-only — see routes/admin.businesses.tsx and api/src/routes/businesses.ts.
export const createBusiness = (accessToken: string, input: CreateBusinessInput) =>
  apiFetch<{ business: Business; temporaryPassword: string }>('/api/businesses', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  })