import type { ReactNode } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from 'react-router'
import type { Route } from './+types/root'

import 'primereact/resources/themes/lara-light-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import './app.css'

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
