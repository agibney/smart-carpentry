import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Message } from 'primereact/message'
import { type FormEvent, useState } from 'react'
import { data, Link, redirect, useNavigation, useSubmit } from 'react-router'
import { requireBusinessSession } from '../lib/auth.server'
import { createProject, getClients } from '../lib/api'
import { PROJECT_STATUSES, type ProjectStatus } from '../lib/types'
import type { Route } from './+types/projects.create'

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken, headers } = await requireBusinessSession(request)
  return data({ clients: await getClients(accessToken) }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken, headers } = await requireBusinessSession(request)
  const body = await request.json()

  if (!body.clientId || !body.title) {
    return data({ error: 'Client and title are required.' }, { headers })
  }

  try {
    const project = await createProject(accessToken, body)
    return redirect(`/projects/${project.id}`, { headers })
  } catch {
    return data({ error: 'Failed to create project.' }, { headers })
  }
}

function toDateString(value: Date | null): string | null {
  if (!value) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CreateProject({ loaderData, actionData }: Route.ComponentProps) {
  const { clients } = loaderData
  const submit = useSubmit()
  const navigation = useNavigation()
  const submitting = navigation.state === 'submitting'

  const [clientId, setClientId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('lead')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [description, setDescription] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(
      {
        clientId,
        title,
        status,
        startDate: toDateString(startDate),
        description: description || null,
      },
      { method: 'post', encType: 'application/json' },
    )
  }

  return (
    <div className="create-project-page">
      <h1>New Project</h1>

      <form className="create-project-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="client">Client</label>
          <Dropdown
            id="client"
            value={clientId}
            onChange={(e) => setClientId(e.value)}
            options={clients}
            optionLabel="name"
            optionValue="id"
            placeholder="Select a client"
          />
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <InputText id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <Dropdown
            id="status"
            value={status}
            onChange={(e) => setStatus(e.value)}
            options={[...PROJECT_STATUSES]}
          />
        </div>

        <div className="field">
          <label htmlFor="startDate">Start Date</label>
          <Calendar
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate((e.value as Date) ?? null)}
            dateFormat="yy-mm-dd"
          />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <InputTextarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        {actionData?.error && <Message severity="error" text={actionData.error} />}

        <div className="form-actions">
          <Link to="/projects">
            <Button type="button" label="Cancel" severity="secondary" text />
          </Link>
          <Button type="submit" label="Create Project" loading={submitting} />
        </div>
      </form>
    </div>
  )
}
