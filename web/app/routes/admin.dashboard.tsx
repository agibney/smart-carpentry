import { data } from 'react-router'
import { LinkButton } from '../components/link-button'
import { StatCard } from '../components/stat-card'
import { requireGlobalSession } from '../lib/auth.server'
import type { Route } from './+types/admin.dashboard'

// The post-login landing page for global admins. Layout only for now: the tiles below are
// placeholders for the planned content (total businesses, recently created businesses,
// anything flagged for admin attention — explicitly not any specific business's
// projects/clients/data) tracked under "Dashboard content" in docs/requirements.md.
export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireGlobalSession(request)
  return data({}, { headers })
}

export default function AdminDashboard() {
  return (
    <div className="grid">
      <div className="col-12">
        <h1>Admin Dashboard</h1>
      </div>

      <div className="col-12 lg:col-6 xl:col-4">
        <StatCard title="Businesses" icon="pi pi-building" caption="Total — coming soon" />
      </div>
      <div className="col-12 lg:col-6 xl:col-4">
        <StatCard title="Recently created" icon="pi pi-clock" caption="New businesses — coming soon" />
      </div>
      <div className="col-12 lg:col-6 xl:col-4">
        <StatCard title="Needs attention" icon="pi pi-flag" caption="Flagged for admin review — coming soon" />
      </div>

      <div className="col-12">
        <div className="card">
          <h5>Quick add</h5>
          <LinkButton to="/admin/businesses" label="New Business" icon="pi pi-plus" />
        </div>
      </div>
    </div>
  )
}
