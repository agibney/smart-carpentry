<script setup lang="ts">
import { PROJECT_STATUSES } from '~/utils/project-status'

const router = useRouter()
const { data: clients } = await useClients()

const clientId = ref<string | null>(null)
const title = ref('')
const status = ref<(typeof PROJECT_STATUSES)[number]>('lead')
const startDate = ref<Date | null>(null)
const description = ref('')

const submitting = ref(false)
const errorMessage = ref('')

const toDateString = (value: Date | null) => {
  if (!value) return null
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const submit = async () => {
  if (!clientId.value || !title.value) {
    errorMessage.value = 'Client and title are required.'
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const project = await createProject({
      clientId: clientId.value,
      title: title.value,
      status: status.value,
      startDate: toDateString(startDate.value),
      description: description.value || null,
    })
    router.push(`/projects/${project.id}`)
  } catch {
    errorMessage.value = 'Failed to create project.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="create-project-page">
    <h1>New Project</h1>

    <form class="create-project-form" @submit.prevent="submit">
      <div class="field">
        <label for="client">Client</label>
        <Select
          id="client"
          v-model="clientId"
          :options="clients ?? []"
          option-label="name"
          option-value="id"
          placeholder="Select a client"
          fluid
        />
      </div>

      <div class="field">
        <label for="title">Title</label>
        <InputText id="title" v-model="title" fluid />
      </div>

      <div class="field">
        <label for="status">Status</label>
        <Select id="status" v-model="status" :options="[...PROJECT_STATUSES]" fluid />
      </div>

      <div class="field">
        <label for="startDate">Start Date</label>
        <DatePicker id="startDate" v-model="startDate" date-format="yy-mm-dd" fluid />
      </div>

      <div class="field">
        <label for="description">Description</label>
        <Textarea id="description" v-model="description" rows="4" fluid />
      </div>

      <Message v-if="errorMessage" severity="error">{{ errorMessage }}</Message>

      <div class="form-actions">
        <Button label="Cancel" severity="secondary" text @click="router.push('/projects')" />
        <Button type="submit" label="Create Project" :loading="submitting" />
      </div>
    </form>
  </div>
</template>

<style scoped>
.create-project-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 32rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>