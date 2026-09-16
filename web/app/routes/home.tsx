import { redirect } from 'react-router'
import { getOptionalSession } from '../lib/auth.server'
import type { Route } from './+types/home'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request)
  // Global admins have no business to see a /projects list for — route them to their actual
  // landing page instead. Anyone else (including a not-yet-logged-in visitor) goes to
  // /projects, whose own loader (requireBusinessSession) is what actually prompts for login.
  if (session?.roles.includes('global-admin')) {
    return redirect('/admin/businesses')
  }
  return redirect('/projects')
}