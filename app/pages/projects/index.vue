<script setup lang="ts">
import type { Project } from '~/composables/useProjects'

const { data: projects, status, error } = await useProjects()

const router = useRouter()

const statusSeverity = (status: string): 'secondary' | 'info' | 'warn' | 'success' | 'danger' => {
  switch (status) {
    case 'lead':
      return 'secondary'
    case 'quoted':
      return 'info'
    case 'active':
      return 'warn'
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'danger'
    default:
      return 'secondary'
  }
}

const formatDate = (value: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

const viewProject = (project: Project) => {
  router.push(`/projects/${project.id}`)
}
</script>

<template>
  <div class="projects-page">
    <h1>Projects</h1>

    <p v-if="error">Failed to load projects.</p>

    <DataTable :value="projects ?? []" :loading="status === 'pending'" data-key="id">
      <Column field="title" header="Title" />

      <Column field="status" header="Status">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>

      <Column field="startDate" header="Start Date">
        <template #body="{ data }">
          {{ formatDate(data.startDate) }}
        </template>
      </Column>

      <Column header="" style="width: 6rem">
        <template #body="{ data }">
          <Button icon="pi pi-eye" text rounded aria-label="View project" @click="viewProject(data)" />
        </template>
      </Column>
    </DataTable>
  </div>
</template>