import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Tag } from 'primereact/tag'
import { Link } from 'react-router'
import { getProjects } from '../lib/api'
import { projectStatusSeverity } from '../lib/project-status'
import type { Project } from '../lib/types'
import type { Route } from './+types/projects'

export async function loader() {
  return { projects: await getProjects() }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export default function ProjectsIndex({ loaderData }: Route.ComponentProps) {
  const { projects } = loaderData

  return (
    <div className="projects-page">
      <div className="projects-page__header">
        <h1>Projects</h1>
        <Link to="/projects/create">
          <Button label="New Project" icon="pi pi-plus" />
        </Link>
      </div>

      <DataTable value={projects} dataKey="id">
        <Column field="title" header="Title" />

        <Column
          field="status"
          header="Status"
          body={(data: Project) => <Tag value={data.status} severity={projectStatusSeverity(data.status)} />}
        />

        <Column field="startDate" header="Start Date" body={(data: Project) => formatDate(data.startDate)} />

        <Column
          header=""
          style={{ width: '6rem' }}
          body={(data: Project) => (
            <Link to={`/projects/${data.id}`}>
              <Button icon="pi pi-eye" text rounded aria-label="View project" />
            </Link>
          )}
        />
      </DataTable>
    </div>
  )
}
