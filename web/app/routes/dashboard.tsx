import { data } from 'react-router'
import { requireBusinessSession } from '../lib/auth.server'
import type { Route } from './+types/dashboard'

// Placeholder — the post-login landing page for business users. Planned content (active
// projects, pending/unsent bids, upcoming start/end dates, quick-add actions) is tracked under
// "Navigation/menu system" in docs/requirements.md, pending the Sakai layout adoption.
export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireBusinessSession(request)
  return data({}, { headers })
}

export default function Dashboard() {
  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
      <p>Coming soon.</p>
    </div>
  )
}
