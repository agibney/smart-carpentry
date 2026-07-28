import type { InferSelectModel } from 'drizzle-orm'
import type { projects } from '~~/server/db/schema'

export type Project = InferSelectModel<typeof projects>

export function useProjects() {
  return useFetch<Project[]>('/api/projects', {
    key: 'projects',
    default: () => [],
  })
}