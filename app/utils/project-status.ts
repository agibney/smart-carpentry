export const PROJECT_STATUSES = ['lead', 'quoted', 'active', 'completed', 'cancelled'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

type TagSeverity = 'secondary' | 'info' | 'warn' | 'success' | 'danger'

const SEVERITY_BY_STATUS: Record<ProjectStatus, TagSeverity> = {
  lead: 'secondary',
  quoted: 'info',
  active: 'warn',
  completed: 'success',
  cancelled: 'danger',
}

export function projectStatusSeverity(status: string): TagSeverity {
  return SEVERITY_BY_STATUS[status as ProjectStatus] ?? 'secondary'
}