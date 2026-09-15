import { buildLoginRedirect } from '../lib/auth.server'
import type { Route } from './+types/auth.login'

// Redirects to Keycloak's own hosted login page (Authorization Code + PKCE) — this route
// never renders anything itself. `returnTo` is set by requireBusinessSession/
// requireGlobalSession (lib/auth.server.ts) when a protected route bounces an unauthenticated
// request here; a plain "Log in" link can omit it and gets role-appropriate default routing
// instead (see handleLoginCallback).
export async function loader({ request }: Route.LoaderArgs) {
  const returnTo = new URL(request.url).searchParams.get('returnTo') || '/'
  return buildLoginRedirect(returnTo)
}