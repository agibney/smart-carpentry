import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { type FormEvent, useState } from 'react'
import { data, useNavigation, useSubmit } from 'react-router'
import { requireGlobalSession } from '../lib/auth.server'
import { createBusiness } from '../lib/api'
import type { Route } from './+types/admin.businesses'

// Global-admin-only — see requireGlobalSession (lib/auth.server.ts) and
// api/src/middleware/globalAdmin.ts for the server-side equivalent of this gate. This is the
// primary V1 login destination (see plan doc): the fastest path to a working test business.
export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireGlobalSession(request)
  return data({}, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken, headers } = await requireGlobalSession(request)
  const body = await request.json()

  if (!body.name || !body.ownerName || !body.ownerEmail) {
    return data({ error: 'Business name, owner name, and owner email are all required.' }, { headers })
  }

  try {
    const result = await createBusiness(accessToken, body)
    return data({ result }, { headers })
  } catch {
    return data({ error: 'Failed to create business.' }, { headers })
  }
}

export default function AdminBusinesses({ actionData }: Route.ComponentProps) {
  const submit = useSubmit()
  const navigation = useNavigation()
  const submitting = navigation.state === 'submitting'

  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit({ name, ownerName, ownerEmail }, { method: 'post', encType: 'application/json' })
  }

  return (
    <div className="admin-businesses-page">
      <h1>Create a Business</h1>
      <p>
        Creates a business row and provisions its Keycloak group + owner user in one step — the fastest way to spin up a
        test tenant while developing. See docs/requirements.md and the auth plan doc for the full design.
      </p>

      <form className="admin-businesses-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Business name</label>
          <InputText id="name" value={name} onChange={(e) => setName(e.target.value)} fluid />
        </div>

        <div className="field">
          <label htmlFor="ownerName">Owner name</label>
          <InputText id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} fluid />
        </div>

        <div className="field">
          <label htmlFor="ownerEmail">Owner email</label>
          <InputText id="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} fluid />
        </div>

        {actionData && 'error' in actionData && <Message severity="error" text={actionData.error} />}

        {actionData && 'result' in actionData && (
          <Message
            severity="success"
            text={`Created "${actionData.result.business.name}". Owner login: ${ownerEmail} / temporary password: ${actionData.result.temporaryPassword} (forced to change it on first login).`}
          />
        )}

        <div className="form-actions">
          <Button type="submit" label="Create Business" loading={submitting} />
        </div>
      </form>
    </div>
  )
}
