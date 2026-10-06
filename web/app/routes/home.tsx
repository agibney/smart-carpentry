import { redirect } from 'react-router'
import { getOptionalSession } from '../lib/auth.server'
import type { Route } from './+types/home'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request)
  // Global admins and business users land on different dashboards — see auth.server.ts's
  // handleLoginCallback for the same split. Anyone else (including a not-yet-logged-in
  // visitor) goes to /dashboard, whose own loader (requireBusinessSession) is what actually
  // prompts for login.
  if (session?.roles.includes('global-admin')) {
    return redirect('/admin/dashboard')
  }
  return redirect('/dashboard')
}