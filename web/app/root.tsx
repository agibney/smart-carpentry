import type { ReactNode } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from 'react-router'
import { getOptionalSession } from './lib/auth.server'
import type { Route } from './+types/root'

import 'primereact/resources/themes/lara-light-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './styles/layout/layout.scss'
import './app.css'

// Runs on every navigation — exposes the current session (or null) to the whole app via
// useRouteLoaderData('root') (read by routes/app-shell.tsx for the sidebar menu and topbar),
// same idea as the old Nuxt app's global auth state. Deliberately does not redirect itself: an
// unauthenticated hit on a public page (or an error page) should render normally, not bounce
// through this loader. Per-route guards (requireBusinessSession / requireGlobalSession,
// lib/auth.server.ts) own the "must be logged in" redirect instead.
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

// The signed-in page chrome (topbar, sidebar, logout) lives in routes/app-shell.tsx's Sakai
// layout, not here — /auth/* and error pages render without it.
export default function App() {
  return <Outlet />
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