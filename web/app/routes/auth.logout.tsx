import { handleLogout } from '../lib/auth.server'
import type { Route } from './+types/auth.logout'

// RP-initiated logout — ends both the local session cookie and the Keycloak SSO session, so a
// subsequent login doesn't silently reuse the old one.
export async function loader({ request }: Route.LoaderArgs) {
  return handleLogout(request)
}