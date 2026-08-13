import type { InferSelectModel } from 'drizzle-orm'
import type { clients, projects } from '~~/server/db/schema'
import type { ProjectStatus } from '~/utils/project-status'

export type Project = InferSelectModel<typeof projects>
export type ProjectWithClient = Project & { client: InferSelectModel<typeof clients> }

export interface CreateProjectInput {
  clientId: string
  title: string
  status?: ProjectStatus
  startDate?: string | null
  description?: string | null
}

export function useProjects() {
  return useFetch<Project[]>('/api/projects', {
    key: 'projects',
    default: () => [],
  })
}

export function useProject(id: string | Ref<string>) {
  return useFetch<ProjectWithClient>(() => `/api/projects/${toValue(id)}`, {
    key: computed(() => `project-${toValue(id)}`),
  })
}

export function createProject(input: CreateProjectInput) {
  return $fetch<Project>('/api/projects', {
    method: 'POST',
    body: input,
  })
}