import { handleLoginCallback } from '../lib/auth.server'
import type { Route } from './+types/auth.callback'

// Keycloak redirects here with ?code=&state= after a successful login — see
// keycloak/import/carpentry-realm.json's web-app client redirectUris.
export async function loader({ request }: Route.LoaderArgs) {
  return handleLoginCallback(request)
}