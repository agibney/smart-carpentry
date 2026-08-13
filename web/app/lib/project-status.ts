import type { ProjectStatus } from './types'

// PrimeReact's Tag severity uses 'warning', not PrimeVue's 'warn'.
type TagSeverity = 'secondary' | 'info' | 'warning' | 'success' | 'danger'

const SEVERITY_BY_STATUS: Record<ProjectStatus, TagSeverity> = {
  lead: 'secondary',
  quoted: 'info',
  active: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

export function projectStatusSeverity(status: string): TagSeverity {
  return SEVERITY_BY_STATUS[status as ProjectStatus] ?? 'secondary'
}
