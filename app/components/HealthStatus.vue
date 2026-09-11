<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <span
        class="inline-block h-3 w-3 rounded-full"
        :class="statusColor"
      />
      <span class="font-medium capitalize">{{ health?.status ?? 'checking' }}</span>
    </div>

    <dl class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt class="text-gray-500">Service</dt>
        <dd class="font-medium text-gray-900">{{ health?.service ?? '—' }}</dd>
      </div>
      <div>
        <dt class="text-gray-500">Version</dt>
        <dd class="font-medium text-gray-900">{{ health?.version ?? '—' }}</dd>
      </div>
      <div>
        <dt class="text-gray-500">Database</dt>
        <dd class="font-medium" :class="health?.database ? 'text-green-600' : 'text-red-600'">
          {{ health?.database ? 'Connected' : 'Unavailable' }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-500">Last checked</dt>
        <dd class="font-medium text-gray-900">
          {{ health ? new Date(health.timestamp).toLocaleTimeString() : '—' }}
        </dd>
      </div>
    </dl>

    <button
      class="text-sm text-blue-600 hover:text-blue-700"
      @click="() => refresh()"
    >
      Refresh
    </button>
  </div>
</template>

<script setup lang="ts">
import type { HealthResponse } from '~/shared/types'

const { data: health, refresh, status } = await useFetch<HealthResponse>(
  '/api/v1/health',
)

const statusColor = computed(() => {
  if (status.value === 'pending') return 'bg-gray-300'
  if (health.value?.status === 'ok') return 'bg-green-500'
  if (health.value?.status === 'degraded') return 'bg-yellow-500'
  return 'bg-red-500'
})
</script>
