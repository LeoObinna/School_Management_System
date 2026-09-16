<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { auditLogsApi, downloadCsv } from '~/services/reports'
import { AUDIT_LOG_RESOURCES } from '~/shared/schemas'
import { formatApiError } from '~/utils/errors'
import type { AuditLogListItem } from '~/shared/types'

definePageMeta({ permissions: ['audit_logs.view'] })

const auth = useAuthStore()
const canExport = computed(() => auth.can('reports.export'))

const loading = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<AuditLogListItem[]>([])

const page = ref(1)
const perPage = 20
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const filters = reactive({
  action: '',
  resource: '' as '' | (typeof AUDIT_LOG_RESOURCES)[number],
  userId: '',
  dateFrom: '',
  dateTo: '',
  search: '',
})

const expanded = ref<Set<string>>(new Set())

function toggleRow(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expanded.value = next
}

function prettyMetadata(raw: string | null): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const result = await auditLogsApi.list({
      page: page.value,
      perPage,
      order: 'desc',
      action: filters.action || undefined,
      resource: filters.resource || undefined,
      userId: filters.userId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      search: filters.search || undefined,
    })
    rows.value = result.data
    total.value = result.meta.total
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadAll()
}

function resetFilters() {
  filters.action = ''
  filters.resource = ''
  filters.userId = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.search = ''
  page.value = 1
  void loadAll()
}

async function exportCsv() {
  try {
    await downloadCsv('/audit-logs', 'audit-logs.csv', {
      action: filters.action || undefined,
      resource: filters.resource || undefined,
      userId: filters.userId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      search: filters.search || undefined,
    })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

function fmtTimestamp(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Audit logs</h1>
        <p class="mt-1 text-sm text-gray-500">
          Security and sensitive-operation events across the SMS.
        </p>
      </div>
      <button
        v-if="canExport"
        class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        @click="exportCsv"
      >
        Export CSV
      </button>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- Filters -->
    <form class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="applyFilters">
      <div>
        <label class="block text-xs font-medium text-gray-600">Action</label>
        <input
          v-model="filters.action"
          type="text"
          placeholder="e.g. student.create"
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">Resource</label>
        <select
          v-model="filters.resource"
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Any</option>
          <option v-for="r in AUDIT_LOG_RESOURCES" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">User ID</label>
        <input
          v-model="filters.userId"
          type="text"
          placeholder="UUID"
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">From</label>
        <input
          v-model="filters.dateFrom"
          type="date"
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">To</label>
        <input
          v-model="filters.dateTo"
          type="date"
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">Search</label>
        <input
          v-model="filters.search"
          type="search"
          placeholder="description / action"
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div class="flex gap-2 sm:col-span-2 lg:col-span-3">
        <button type="submit" class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Apply
        </button>
        <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="resetFilters">
          Reset
        </button>
      </div>
    </form>

    <!-- Table -->
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Timestamp</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Resource</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">IP</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-gray-400">Loading…</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td colspan="6" class="px-4 py-6 text-center text-gray-400">No audit entries match the filters.</td>
          </tr>
          <template v-else>
            <template v-for="row in rows" :key="row.id">
              <tr class="cursor-pointer hover:bg-gray-50" @click="toggleRow(row.id)">
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{{ fmtTimestamp(row.createdAt) }}</td>
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900">{{ row.userName ?? 'System / deleted user' }}</div>
                  <div v-if="row.userEmail" class="text-xs text-gray-500">{{ row.userEmail }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">{{ row.action }}</td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">{{ row.resource }}</td>
                <td class="px-4 py-3 text-gray-700">{{ row.description ?? '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">{{ row.ipAddress ?? '—' }}</td>
              </tr>
              <tr v-if="expanded.has(row.id)" class="bg-gray-50">
                <td colspan="6" class="px-4 py-3">
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div class="text-xs font-medium uppercase text-gray-500">Resource ID</div>
                      <div class="mt-1 font-mono text-xs text-gray-700">{{ row.resourceId ?? '—' }}</div>
                    </div>
                    <div>
                      <div class="text-xs font-medium uppercase text-gray-500">User agent</div>
                      <div class="mt-1 text-xs text-gray-700">{{ row.userAgent ?? '—' }}</div>
                    </div>
                    <div class="sm:col-span-2">
                      <div class="text-xs font-medium uppercase text-gray-500">Metadata</div>
                      <pre class="mt-1 max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">{{ prettyMetadata(row.metadata) }}</pre>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > 0" class="flex items-center justify-between">
      <p class="text-sm text-gray-500">
        Page {{ page }} of {{ lastPage }} · {{ total }} entries
      </p>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
          @click="page--; loadAll()"
        >
          Previous
        </button>
        <button
          :disabled="page >= lastPage"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
          @click="page++; loadAll()"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
