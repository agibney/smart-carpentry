import type { ReactNode } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteLoaderData } from 'react-router'
import { getOptionalSession } from './lib/auth.server'
import type { Route } from './+types/root'

import 'primereact/resources/themes/lara-light-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import './app.css'

// Runs on every navigation — exposes the current session (or null) to the whole app via
// useRouteLoaderData('root'), same idea as the old Nuxt app's global auth state. Deliberately
// does not redirect itself: an unauthenticated hit on a public page (or an error page) should
// render normally, not bounce through this loader. Per-route guards (requireBusinessSession /
// requireGlobalSession, lib/auth.server.ts) own the "must be logged in" redirect instead.
export async function loader({ request }: Route.LoaderArgs) {
  return { user: await getOptionalSession(request) }
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Smart Carpentry</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const data = useRouteLoaderData<typeof loader>('root')
  const user = data?.user

  return (
    <>
      <header className="app-nav">
        <span className="app-nav__brand">Smart Carpentry</span>
        {user ? (
          <span className="app-nav__session">
            {user.name} {user.roles.includes('global-admin') && '(admin)'}
            {' · '}
            <a href="/auth/logout">Log out</a>
          </span>
        ) : (
          <a href="/auth/login">Log in</a>
        )}
      </header>
      <Outlet />
    </>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Something went wrong'
  let details = 'An unexpected error occurred.'

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? 'Not Found' : `Error ${error.status}`
    details = error.data || error.statusText || details
  } else if (error instanceof Error) {
    details = error.message
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>{message}</h1>
      <p>{details}</p>
    </main>
  )
}