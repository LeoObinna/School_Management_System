<script setup lang="ts">
/**
 * Student portal — learning resources browser (Phase 16A). Read-only
 * view over GET /api/v1/resources; the server already scopes results
 * to published resources for the student's enrolled classes.
 */
import { resourcesApi } from '~/services/assignments'
import { formatApiError } from '~/utils/errors'
import type { LearningResourceListItem } from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['resources.view'] })

const resources = ref<LearningResourceListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

onMounted(async () => {
  try {
    const response = await resourcesApi.list()
    resources.value = response.data
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="font-display text-2xl font-semibold text-text-primary">
        Learning resources
      </h1>
      <p class="mt-1 text-sm text-text-secondary">
        Materials shared by your teachers.
      </p>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading resources…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <p
      v-else-if="resources.length === 0"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      No resources have been shared yet.
    </p>

    <ul v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <li
        v-for="resource in resources"
        :key="resource.id"
        class="flex flex-col rounded-xl border border-border-default bg-surface p-5"
      >
        <div class="flex-1">
          <p class="text-sm font-medium text-text-primary">
            {{ resource.title }}
          </p>
          <p v-if="resource.description" class="mt-1 text-sm text-text-secondary">
            {{ resource.description }}
          </p>
          <p class="mt-2 text-xs text-text-muted">
            {{ resource.className ?? 'All classes' }}
            <template v-if="resource.subjectName">
              · {{ resource.subjectName }}</template
            >
            <template v-if="resource.uploadedByName">
              · {{ resource.uploadedByName }}</template
            >
            · {{ fmtDate(resource.createdAt) }}
          </p>
          <p class="mt-1 text-xs text-text-muted">{{ resource.fileName }}</p>
        </div>
        <a
          :href="resourcesApi.downloadUrl(resource.id)"
          class="mt-4 inline-block w-fit rounded-md border border-border-strong px-3 py-1.5 text-sm text-brand-primary hover:bg-surface-muted"
          download
        >
          Download
        </a>
      </li>
    </ul>
  </div>
</template>
