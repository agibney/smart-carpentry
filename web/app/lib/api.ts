// Loader/action-facing API client — the only place the frontend talks to the api/ Express
// server. This is the analog of the old Nuxt composables, but it only ever runs server-side
// (inside RR7 loaders/actions), since framework-mode SSR resolves data before the browser
// gets involved.
import type { Client, CreateProjectInput, Project, ProjectWithClient } from './types'

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Response(body.error ?? res.statusText, { status: res.status })
  }

  return res.json()
}

export const getProjects = () => apiFetch<Project[]>('/api/projects')

export const getProject = (id: string) => apiFetch<ProjectWithClient>(`/api/projects/${id}`)

export const createProject = (input: CreateProjectInput) =>
  apiFetch<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const getClients = () => apiFetch<Client[]>('/api/clients')
