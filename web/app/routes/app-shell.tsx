import { Outlet, useRouteLoaderData } from 'react-router'
import { AppLayout } from '../layout/app-layout'
import { dashboardPathFor, menuFor } from '../lib/menu'
import type { loader as rootLoader } from '../root'

// Pathless layout route wrapping every signed-in page in the Sakai shell (see routes.ts). No
// loader/guard of its own: each child route's requireBusinessSession / requireGlobalSession
// already owns the login redirect and role check, and the session itself comes from root.tsx's
// loader rather than being re-read here.
export default function AppShell() {
  const user = useRouteLoaderData<typeof rootLoader>('root')?.user

  // Only reachable if a child route forgot its guard — render bare rather than with an empty menu.
  if (!user) return <Outlet />

  const isGlobalAdmin = user.roles.includes('global-admin')

  return (
    <AppLayout
      menu={menuFor(user.roles)}
      userLabel={isGlobalAdmin ? `${user.name} (admin)` : user.name}
      homePath={dashboardPathFor(user.roles)}
    >
      <Outlet />
    </AppLayout>
  )
}
