import { data } from 'react-router'
import { requireGlobalSession } from '../lib/auth.server'
import type { Route } from './+types/admin.dashboard'

// Placeholder — the post-login landing page for global admins. Planned content (total
// businesses, recently created businesses, anything flagged for admin attention — explicitly
// not any specific business's projects/clients/data) is tracked under "Navigation/menu system"
// in docs/requirements.md, pending the Sakai layout adoption.
export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireGlobalSession(request)
  return data({}, { headers })
}

export default function AdminDashboard() {
  return (
    <div className="admin-dashboard-page">
      <h1>Admin Dashboard</h1>
      <p>Coming soon.</p>
    </div>
  )
}
