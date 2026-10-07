import { data } from 'react-router'
import { LinkButton } from '../components/link-button'
import { StatCard } from '../components/stat-card'
import { requireBusinessSession } from '../lib/auth.server'
import type { Route } from './+types/dashboard'

// The post-login landing page for business users. Layout only for now: the tiles below are
// placeholders for the planned content (active projects, pending/unsent bids, upcoming
// start/end dates) tracked under "Dashboard content" in docs/requirements.md — wire each one
// up in this loader as its data lands.
export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireBusinessSession(request)
  return data({}, { headers })
}

export default function Dashboard() {
  return (
    <div className="grid">
      <div className="col-12">
        <h1>Dashboard</h1>
      </div>

      <div className="col-12 lg:col-6 xl:col-4">
        <StatCard title="Active projects" icon="pi pi-briefcase" caption="Coming soon" />
      </div>
      <div className="col-12 lg:col-6 xl:col-4">
        <StatCard title="Pending bids" icon="pi pi-file-edit" caption="Drafted or not yet sent — coming soon" />
      </div>
      <div className="col-12 lg:col-6 xl:col-4">
        <StatCard title="Upcoming dates" icon="pi pi-calendar" caption="Project starts and finishes — coming soon" />
      </div>

      <div className="col-12">
        <div className="card">
          <h5>Quick add</h5>
          <LinkButton to="/projects/create" label="New Project" icon="pi pi-plus" />
        </div>
      </div>
    </div>
  )
}
