import { redirect } from 'react-router'
import { getOptionalSession } from '../lib/auth.server'
import { dashboardPathFor } from '../lib/menu'
import type { Route } from './+types/home'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request)
  // Global admins and business users land on different dashboards (dashboardPathFor, also
  // used by auth.server.ts's handleLoginCallback). Anyone else (including a not-yet-logged-in
  // visitor) goes to /dashboard, whose own loader (requireBusinessSession) is what actually
  // prompts for login.
  return redirect(dashboardPathFor(session?.roles ?? []))
}