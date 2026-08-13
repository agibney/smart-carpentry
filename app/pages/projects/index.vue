<script setup lang="ts">
import type { Project } from '~/composables/useProjects'

const { data: projects, status, error } = await useProjects()

const router = useRouter()

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
    <div class="projects-page__header">
      <h1>Projects</h1>
      <Button label="New Project" icon="pi pi-plus" @click="router.push('/projects/create')" />
    </div>

    <p v-if="error">Failed to load projects.</p>

    <DataTable :value="projects ?? []" :loading="status === 'pending'" data-key="id">
      <Column field="title" header="Title" />

      <Column field="status" header="Status">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="projectStatusSeverity(data.status)" />
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

<style scoped>
.projects-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>