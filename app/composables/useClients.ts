import type { InferSelectModel } from 'drizzle-orm'
import type { clients } from '~~/server/db/schema'

export type Client = InferSelectModel<typeof clients>

export function useClients() {
  return useFetch<Client[]>('/api/clients', {
    key: 'clients',
    default: () => [],
  })
}