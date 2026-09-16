import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { data, Link } from 'react-router'
import { requireBusinessSession } from '../lib/auth.server'
import { getProject } from '../lib/api'
import { projectStatusSeverity } from '../lib/project-status'
import type { Route } from './+types/projects.$id'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { accessToken, headers } = await requireBusinessSession(request)
  return data({ project: await getProject(accessToken, params.id) }, { headers })
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export default function ProjectDetail({ loaderData }: Route.ComponentProps) {
  const { project } = loaderData

  return (
    <div className="project-detail-page">
      <Link to="/projects">
        <Button label="Back to Projects" icon="pi pi-arrow-left" text />
      </Link>

      <Card
        title={
          <div className="project-detail-page__title">
            {project.title}
            <Tag value={project.status} severity={projectStatusSeverity(project.status)} />
          </div>
        }
      >
        <dl className="project-detail-page__fields">
          <dt>Client</dt>
          <dd>{project.client.name}</dd>

          <dt>Start Date</dt>
          <dd>{formatDate(project.startDate)}</dd>

          <dt>End Date</dt>
          <dd>{formatDate(project.endDate)}</dd>

          <dt>Description</dt>
          <dd>{project.description || '—'}</dd>
        </dl>
      </Card>
    </div>
  )
}
