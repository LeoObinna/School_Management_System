<script setup lang="ts">
/**
 * Staff contact inbox (Phase 18C) — triage for public contact-form
 * submissions. List with status filter, detail modal, mark read /
 * archive (audited server-side).
 */
import { contactMessagesApi } from '~/services/contact-messages'
import { formatApiError } from '~/utils/errors'
import type { ContactMessage, ContactMessageStatus } from '~/shared/types'

definePageMeta({ permissions: ['contact_messages.view'] })

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const messages = ref<ContactMessage[]>([])

const page = ref(1)
const perPage = 20
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const statusFilter = ref<'' | ContactMessageStatus>('')

const STATUS_LABELS: Record<ContactMessageStatus, string> = {
  new: 'New',
  read: 'Read',
  archived: 'Archived',
}

const STATUS_BADGES: Record<ContactMessageStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  read: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
}

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const result = await contactMessagesApi.list({
      page: page.value,
      perPage,
      status: statusFilter.value || undefined,
    })
    messages.value = result.data
    total.value = result.meta.total
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(statusFilter, () => {
  page.value = 1
  void loadAll()
})

onMounted(() => {
  void loadAll()
})

function fmtDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

// ---------------------------------------------------------------------------
// Detail modal + status actions
// ---------------------------------------------------------------------------

const detailOpen = ref(false)
const detail = ref<ContactMessage | null>(null)
const actionBusy = ref(false)

async function openDetail(row: ContactMessage) {
  detail.value = row
  detailOpen.value = true
  // Opening a new message marks it read.
  if (row.status === 'new') {
    await setStatus(row, 'read', { silent: true })
  }
}

async function setStatus(
  row: ContactMessage,
  status: 'read' | 'archived',
  options: { silent?: boolean } = {},
) {
  actionBusy.value = true
  loadError.value = null
  try {
    await contactMessagesApi.updateStatus(row.id, { status })
    if (!options.silent) {
      notice.value =
        status === 'read'
          ? `Marked message from ${row.name} as read.`
          : `Archived message from ${row.name}.`
    }
    if (detail.value?.id === row.id) detail.value = { ...detail.value, status }
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    actionBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Contact messages</h1>
        <p class="mt-1 text-sm text-gray-500">
          Messages sent through the public website contact form.
        </p>
      </div>
      <NuxtLink
        to="/dashboard"
        class="text-sm text-indigo-600 hover:text-indigo-800"
      >
        ← Dashboard
      </NuxtLink>
    </div>

    <p
      v-if="notice"
      class="rounded-md bg-green-50 p-3 text-sm text-green-800"
      @click="notice = null"
    >
      {{ notice }}
    </p>
    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- Status filter -->
    <div class="flex flex-wrap gap-3">
      <select
        v-model="statusFilter"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option
          v-for="(label, key) in STATUS_LABELS"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
    <div
      v-else-if="messages.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"
    >
      No contact messages found.
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">From</th>
            <th class="px-4 py-3 font-medium">Subject</th>
            <th class="px-4 py-3 font-medium">Topic</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Received</th>
            <th class="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in messages" :key="row.id">
            <td class="px-4 py-3">
              <p class="font-medium text-gray-900">{{ row.name }}</p>
              <p class="text-xs text-gray-500">{{ row.email }}</p>
            </td>
            <td class="max-w-xs truncate px-4 py-3 text-gray-700">
              {{ row.subject }}
            </td>
            <td class="px-4 py-3 text-gray-600">{{ row.department || '—' }}</td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_BADGES[row.status]"
              >
                {{ STATUS_LABELS[row.status] }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ fmtDate(row.createdAt) }}</td>
            <td class="space-x-2 px-4 py-3">
              <button
                class="text-indigo-600 hover:text-indigo-800"
                @click="openDetail(row)"
              >
                View
              </button>
              <button
                v-if="row.status !== 'archived'"
                class="text-gray-600 hover:text-gray-800"
                :disabled="actionBusy"
                @click="setStatus(row, 'archived')"
              >
                Archive
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="total > perPage"
      class="flex items-center justify-between text-sm text-gray-600"
    >
      <p>Page {{ page }} of {{ lastPage }} ({{ total }} messages)</p>
      <div class="space-x-2">
        <button
          class="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-50"
          :disabled="page <= 1"
          @click="page--; loadAll()"
        >
          Previous
        </button>
        <button
          class="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-50"
          :disabled="page >= lastPage"
          @click="page++; loadAll()"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Detail modal -->
    <div
      v-if="detailOpen && detail"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="detailOpen = false"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="`Message from ${detail.name}`"
        class="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ detail.subject }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              From {{ detail.name }} &lt;{{ detail.email }}&gt;
              <span v-if="detail.phone"> · {{ detail.phone }}</span>
              <span v-if="detail.department"> · {{ detail.department }}</span>
            </p>
            <p class="mt-0.5 text-xs text-gray-400">
              Received {{ fmtDate(detail.createdAt) }}
            </p>
          </div>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium"
            :class="STATUS_BADGES[detail.status]"
          >
            {{ STATUS_LABELS[detail.status] }}
          </span>
        </div>

        <p class="mt-4 whitespace-pre-line text-sm text-gray-800">
          {{ detail.body }}
        </p>

        <div class="mt-6 flex items-center justify-end gap-2">
          <button
            v-if="detail.status === 'archived'"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            :disabled="actionBusy"
            @click="setStatus(detail, 'read')"
          >
            Reopen
          </button>
          <button
            v-else
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            :disabled="actionBusy"
            @click="setStatus(detail, 'archived')"
          >
            Archive
          </button>
          <a
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            :href="`mailto:${detail.email}?subject=Re: ${detail.subject}`"
          >
            Reply by email
          </a>
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            @click="detailOpen = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
