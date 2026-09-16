<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { eventsApi } from '~/services/events'
import { formatApiError } from '~/utils/errors'
import type {
  Audience,
  EventStatus,
  SchoolEventListItem,
} from '~/shared/types'

definePageMeta({ permissions: ['events.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('events.manage'))

// ---------------------------------------------------------------------------
// List + filters
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const events = ref<SchoolEventListItem[]>([])

const page = ref(1)
const perPage = 20
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const filters = reactive({
  search: '',
  status: '' as '' | EventStatus,
  audience: '' as '' | Audience,
})

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'All',
  staff: 'Staff',
  teachers: 'Teachers',
  students: 'Students',
  parents: 'Parents',
  admins: 'Admins',
}

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  cancelled: 'Cancelled',
}

const STATUS_BADGES: Record<EventStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const result = await eventsApi.list({
      page: page.value,
      perPage,
      search: filters.search || undefined,
      status: filters.status || undefined,
      audience: filters.audience || undefined,
    })
    events.value = result.data
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

watch(
  () => [filters.status, filters.audience],
  () => applyFilters(),
)

onMounted(() => {
  void loadAll()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

const formModalOpen = ref(false)
const editingId = ref<string | null>(null)
const formSaving = ref(false)
const formError = ref<string | null>(null)
const eventForm = reactive({
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  audience: 'all' as Audience,
  status: 'draft' as EventStatus,
})

function resetForm() {
  Object.assign(eventForm, {
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    location: '',
    audience: 'all',
    status: 'draft',
  })
}

function openCreate() {
  editingId.value = null
  resetForm()
  formError.value = null
  formModalOpen.value = true
}

function openEdit(row: SchoolEventListItem) {
  editingId.value = row.id
  Object.assign(eventForm, {
    title: row.title,
    description: row.description ?? '',
    startsAt: toLocalInput(row.startsAt),
    endsAt: toLocalInput(row.endsAt),
    location: row.location ?? '',
    audience: row.audience,
    status: (row.status as EventStatus) || 'draft',
  })
  formError.value = null
  formModalOpen.value = true
}

async function submitForm() {
  formSaving.value = true
  formError.value = null
  const body = {
    title: eventForm.title.trim(),
    description: eventForm.description.trim() || null,
    startsAt: new Date(eventForm.startsAt).toISOString(),
    endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : null,
    location: eventForm.location.trim() || null,
    audience: eventForm.audience,
    status: eventForm.status,
  }
  try {
    if (editingId.value) {
      await eventsApi.update(editingId.value, body)
    } else {
      await eventsApi.create(body)
    }
    formModalOpen.value = false
    await loadAll()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    formSaving.value = false
  }
}

async function deleteEvent(row: SchoolEventListItem) {
  if (!window.confirm(`Delete event "${row.title}"?`)) return
  try {
    await eventsApi.del(row.id)
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Events</h1>
        <p class="mt-1 text-sm text-gray-500">
          School events, schedules and announcements.
        </p>
      </div>
      <button
        v-if="canManage"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New event
      </button>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- Filters -->
    <form class="flex flex-wrap gap-3" @submit.prevent="applyFilters">
      <input
        v-model="filters.search"
        type="search"
        placeholder="Search title, location…"
        class="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        v-model="filters.status"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
      <select
        v-model="filters.audience"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All audiences</option>
        <option
          v-for="(label, key) in AUDIENCE_LABELS"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
      <button
        type="submit"
        class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
      >
        Search
      </button>
    </form>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
    <div
      v-else-if="events.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"
    >
      No events found.
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Title</th>
            <th class="px-4 py-3 font-medium">Starts at</th>
            <th class="px-4 py-3 font-medium">Location</th>
            <th class="px-4 py-3 font-medium">Audience</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Created by</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in events"
            :key="row.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3 font-medium text-gray-800">{{ row.title }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">
              {{ fmtDateTime(row.startsAt) }}
            </td>
            <td class="px-4 py-3 text-gray-600">{{ row.location || '—' }}</td>
            <td class="px-4 py-3 text-gray-600">
              {{ AUDIENCE_LABELS[row.audience] }}
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_BADGES[row.status as EventStatus]"
              >
                {{ STATUS_LABELS[row.status as EventStatus] }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ row.createdByName || '—' }}</td>
            <td class="px-4 py-3 text-right">
              <div v-if="canManage" class="flex justify-end gap-3 text-xs">
                <button class="text-gray-600 hover:underline" @click="openEdit(row)">
                  Edit
                </button>
                <button class="text-red-700 hover:underline" @click="deleteEvent(row)">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > 0" class="flex items-center justify-between text-sm text-gray-600">
      <span>{{ total }} event(s) · page {{ page }} of {{ lastPage }}</span>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page--; void loadAll()"
        >
          Previous
        </button>
        <button
          :disabled="page >= lastPage"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page++; void loadAll()"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create / edit event -->
    <BaseModal
      :open="formModalOpen"
      :title="editingId ? 'Edit event' : 'New event'"
      wide
      @close="formModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitForm">
        <p v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ formError }}
        </p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Title *</span>
          <input
            v-model="eventForm.title"
            required
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Description</span>
          <textarea
            v-model="eventForm.description"
            rows="4"
            maxlength="20000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Starts at *</span>
            <input
              v-model="eventForm.startsAt"
              type="datetime-local"
              required
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Ends at</span>
            <input
              v-model="eventForm.endsAt"
              type="datetime-local"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Location</span>
            <input
              v-model="eventForm.location"
              maxlength="255"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Audience</span>
            <select
              v-model="eventForm.audience"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option
                v-for="(label, key) in AUDIENCE_LABELS"
                :key="key"
                :value="key"
              >
                {{ label }}
              </option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Status</span>
            <select
              v-model="eventForm.status"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option
                v-for="(label, key) in STATUS_LABELS"
                :key="key"
                :value="key"
              >
                {{ label }}
              </option>
            </select>
          </label>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            @click="formModalOpen = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="formSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ formSaving ? 'Saving…' : 'Save event' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
