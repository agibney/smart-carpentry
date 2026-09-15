// Thin client over Keycloak's Admin REST API, used only by POST /api/businesses
// (routes/businesses.ts) to provision a new business's group + owner user at creation time.
// Not a general-purpose Keycloak SDK — just the handful of calls that flow needs.
const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080'
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'carpentry'

const BUSINESSES_GROUP_NAME = 'businesses'

class KeycloakAdminError extends Error {}

async function kcFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${KEYCLOAK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new KeycloakAdminError(`Keycloak admin API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
  }

  return res
}

/** Location header of a Keycloak admin "create" response holds the new resource's id. */
function idFromLocation(res: Response): string {
  const location = res.headers.get('Location')
  if (!location) {
    throw new KeycloakAdminError('Keycloak admin API create response had no Location header')
  }
  return location.split('/').pop()!
}

/**
 * Direct Access Grant against the master realm's built-in admin-cli client, using the
 * container's bootstrap admin credentials. Realm/group/user management is a master-realm
 * privilege in Keycloak's default authorization model, so this is the pragmatic choice for a
 * personal project's one server-to-server automation path (kcadm.sh itself works the same
 * way) — distinct from the "no password grant for end users" rule elsewhere in this app,
 * since this never touches a real user's credentials. A narrowly-scoped service-account
 * client is the production-grade hardening, left as future work.
 */
async function getProvisionerToken(): Promise<string> {
  const username = process.env.KEYCLOAK_PROVISIONER_USERNAME
  const password = process.env.KEYCLOAK_PROVISIONER_PASSWORD

  if (!username || !password) {
    throw new KeycloakAdminError('KEYCLOAK_PROVISIONER_USERNAME/PASSWORD are not configured')
  }

  const res = await fetch(`${KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username,
      password,
    }),
  })

  if (!res.ok) {
    throw new KeycloakAdminError(`Failed to obtain Keycloak provisioner token: ${res.status} ${await res.text().catch(() => '')}`)
  }

  const { access_token: accessToken } = (await res.json()) as { access_token: string }
  return accessToken
}

async function findGroupIdByName(token: string, name: string, parentId?: string): Promise<string | null> {
  const path = parentId
    ? `/admin/realms/${KEYCLOAK_REALM}/groups/${parentId}/children?search=${encodeURIComponent(name)}&exact=true`
    : `/admin/realms/${KEYCLOAK_REALM}/groups?search=${encodeURIComponent(name)}&exact=true`

  const res = await kcFetch(path, token)
  const groups = (await res.json()) as Array<{ id: string; name: string }>
  return groups.find((g) => g.name === name)?.id ?? null
}

async function ensureBusinessesParentGroup(token: string): Promise<string> {
  const existing = await findGroupIdByName(token, BUSINESSES_GROUP_NAME)
  if (existing) return existing

  const res = await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/groups`, token, {
    method: 'POST',
    body: JSON.stringify({ name: BUSINESSES_GROUP_NAME }),
  })
  return idFromLocation(res)
}

async function findRoleByName(token: string, name: string): Promise<{ id: string; name: string }> {
  const res = await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/roles/${encodeURIComponent(name)}`, token)
  return (await res.json()) as { id: string; name: string }
}

function generateTemporaryPassword(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

/**
 * Creates the /businesses/<businessId> group and its owner user, matching the shape the
 * seeded realm-import JSON establishes for DEFAULT_BUSINESS_ID (see
 * keycloak/import/carpentry-realm.json) — this function is the runtime equivalent of that
 * file's "users" + "groups" entries for every business created after the app is running.
 */
export async function provisionBusiness(
  businessId: string,
  owner: { name: string; email: string },
): Promise<{ keycloakUserId: string; temporaryPassword: string }> {
  const token = await getProvisionerToken()

  const parentGroupId = await ensureBusinessesParentGroup(token)

  let groupId = await findGroupIdByName(token, businessId, parentGroupId)
  if (!groupId) {
    const res = await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/groups/${parentGroupId}/children`, token, {
      method: 'POST',
      body: JSON.stringify({ name: businessId }),
    })
    groupId = idFromLocation(res)
  }

  const temporaryPassword = generateTemporaryPassword()
  const [firstName, ...rest] = owner.name.split(' ')
  const lastName = rest.join(' ') || firstName

  const userRes = await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/users`, token, {
    method: 'POST',
    body: JSON.stringify({
      username: owner.email,
      email: owner.email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: temporaryPassword, temporary: true }],
      requiredActions: ['UPDATE_PASSWORD'],
    }),
  })
  const keycloakUserId = idFromLocation(userRes)

  await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUserId}/groups/${groupId}`, token, {
    method: 'PUT',
  })

  const ownerRole = await findRoleByName(token, 'owner')
  await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUserId}/role-mappings/realm`, token, {
    method: 'POST',
    body: JSON.stringify([ownerRole]),
  })

  return { keycloakUserId, temporaryPassword }
}

/** Compensating action for a failed Postgres write after Keycloak provisioning succeeded —
 * removes the group and its owner user so a retried business creation doesn't collide. */
export async function deprovisionBusiness(businessId: string, keycloakUserId: string): Promise<void> {
  const token = await getProvisionerToken()

  await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUserId}`, token, { method: 'DELETE' }).catch(() => {})

  const parentGroupId = await findGroupIdByName(token, BUSINESSES_GROUP_NAME)
  if (parentGroupId) {
    const groupId = await findGroupIdByName(token, businessId, parentGroupId)
    if (groupId) {
      await kcFetch(`/admin/realms/${KEYCLOAK_REALM}/groups/${groupId}`, token, { method: 'DELETE' }).catch(() => {})
    }
  }
}
