// Sidebar menu per user type — see "Navigation/menu system" in docs/requirements.md for the
// full planned structure. Only routes that actually exist are listed; add each remaining item
// (Clients, Subcontractors, Materials, Settings, Users) as its page lands, rather than linking
// to dead or placeholder routes. Bids stay nested under individual projects, not top-level.

export type MenuItem = {
  label: string
  icon: string
  to: string
  // Match only the exact path (NavLink's `end`) — for items like Dashboard whose path would
  // otherwise also match every route nested under it.
  end?: boolean
}

export type MenuSection = {
  label: string
  items: MenuItem[]
}

const businessMenu: MenuSection[] = [
  { label: 'Home', items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/dashboard', end: true }] },
  { label: 'Work', items: [{ label: 'Projects', icon: 'pi pi-fw pi-briefcase', to: '/projects' }] },
]

const globalAdminMenu: MenuSection[] = [
  { label: 'Home', items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/admin/dashboard', end: true }] },
  { label: 'Administration', items: [{ label: 'Businesses', icon: 'pi pi-fw pi-building', to: '/admin/businesses' }] },
]

// The single global-admin vs. business-user split for navigation — home.tsx's redirect and
// auth.server.ts's handleLoginCallback use dashboardPathFor rather than repeating it.
export function menuFor(roles: string[]): MenuSection[] {
  return roles.includes('global-admin') ? globalAdminMenu : businessMenu
}

export function dashboardPathFor(roles: string[]): string {
  return roles.includes('global-admin') ? '/admin/dashboard' : '/dashboard'
}
