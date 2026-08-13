<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { data: project, status, error } = await useProject(route.params.id as string)

const formatDate = (value: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}
</script>

<template>
  <div class="project-detail-page">
    <Button label="Back to Projects" icon="pi pi-arrow-left" text @click="router.push('/projects')" />

    <p v-if="status === 'pending'">Loading…</p>
    <p v-else-if="error">Failed to load project.</p>

    <Card v-else-if="project">
      <template #title>
        <div class="project-detail-page__title">
          {{ project.title }}
          <Tag :value="project.status" :severity="projectStatusSeverity(project.status)" />
        </div>
      </template>
      <template #content>
        <dl class="project-detail-page__fields">
          <dt>Client</dt>
          <dd>{{ project.client.name }}</dd>

          <dt>Start Date</dt>
          <dd>{{ formatDate(project.startDate) }}</dd>

          <dt>End Date</dt>
          <dd>{{ formatDate(project.endDate) }}</dd>

          <dt>Description</dt>
          <dd>{{ project.description || '—' }}</dd>
        </dl>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.project-detail-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 40rem;
}

.project-detail-page__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.project-detail-page__fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
}

.project-detail-page__fields dt {
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.project-detail-page__fields dd {
  margin: 0;
}
</style>
