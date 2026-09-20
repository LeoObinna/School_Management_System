<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { announcementsApi } from '~/services/communication'
import { formatApiError } from '~/utils/errors'
import type {
  AnnouncementListItem,
  AnnouncementStatus,
  Audience,
} from '~/shared/types'

definePageMeta({ permissions: ['announcements.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('announcements.create'))
const canUpdate = computed(() => auth.can('announcements.update'))
const canPublish = computed(() => auth.can('announcements.publish'))

// ---------------------------------------------------------------------------
// List + filters
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const announcements = ref<AnnouncementListItem[]>([])

const page = ref(1)
const perPage = 20
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const filters = reactive({
  search: '',
  status: '' as '' | AnnouncementStatus,
  audience: '' as '' | Audience,
})

const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_BADGES: Record<AnnouncementStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-yellow-100 text-yellow-700',
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'All',
  staff: 'Staff',
  teachers: 'Teachers',
  students: 'Students',
  parents: 'Parents',
  admins: 'Admins',
}

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const result = await announcementsApi.list({
      page: page.value,
      perPage,
      search: filters.search || undefined,
      status: filters.status || undefined,
      audience: filters.audience || undefined,
    })
    announcements.value = result.data
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

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

const formModalOpen = ref(false)
const editingId = ref<string | null>(null)
const formSaving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  title: '',
  body: '',
  audience: 'all' as Audience,
  status: 'draft' as AnnouncementStatus,
  // datetime-local value (browser local zone); sent as UTC ISO.
  scheduledFor: '',
})

/** Converts a UTC ISO instant to a datetime-local value in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function resetForm() {
  Object.assign(form, {
    title: '',
    body: '',
    audience: 'all',
    status: 'draft',
    scheduledFor: '',
  })
}

function openCreate() {
  editingId.value = null
  resetForm()
  formError.value = null
  formModalOpen.value = true
}

function openEdit(row: AnnouncementListItem) {
  editingId.value = row.id
  Object.assign(form, {
    title: row.title,
    body: row.body ?? '',
    audience: row.audience,
    status: row.status,
    scheduledFor: row.scheduledFor ? toLocalInput(row.scheduledFor) : '',
  })
  formError.value = null
  formModalOpen.value = true
}

async function submitForm() {
  formSaving.value = true
  formError.value = null
  const body = {
    title: form.title.trim(),
    body: form.body.trim() || null,
    audience: form.audience,
    status: form.status,
    ...(form.status === 'scheduled' && form.scheduledFor
      ? { scheduledFor: new Date(form.scheduledFor).toISOString() }
      : {}),
  }
  try {
    if (editingId.value) {
      await announcementsApi.update(editingId.value, body)
    } else {
      await announcementsApi.create(body)
    }
    formModalOpen.value = false
    await loadAll()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    formSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Actions: publish / archive / delete
// ---------------------------------------------------------------------------

async function publishAnnouncement(row: AnnouncementListItem) {
  if (!window.confirm(`Publish "${row.title}"? Notifications will be sent to the audience.`)) {
    return
  }
  try {
    const result = await announcementsApi.publish(row.id)
    notice.value = `Published — ${result.notified} notification${result.notified === 1 ? '' : 's'} sent`
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function archiveAnnouncement(row: AnnouncementListItem) {
  if (!window.confirm(`Archive "${row.title}"?`)) return
  try {
    await announcementsApi.archive(row.id)
    notice.value = `Archived "${row.title}".`
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function deleteAnnouncement(row: AnnouncementListItem) {
  if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return
  try {
    await announcementsApi.del(row.id)
    notice.value = `Deleted "${row.title}".`
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
        <h1 class="text-2xl font-semibold text-gray-900">Announcements</h1>
        <p class="mt-1 text-sm text-gray-500">
          Broadcast updates to staff, teachers, students and parents.
        </p>
      </div>
      <button
        v-if="canCreate"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New announcement
      </button>
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

    <!-- Filters -->
    <form class="flex flex-wrap gap-3" @submit.prevent="applyFilters">
      <input
        v-model="filters.search"
        type="search"
        placeholder="Search title, body, author…"
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
      v-else-if="announcements.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"
    >
      No announcements found.
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Title</th>
            <th class="px-4 py-3 font-medium">Audience</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Author</th>
            <th class="px-4 py-3 font-medium">Published</th>
            <th class="px-4 py-3 font-medium">Created</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="a in announcements"
            :key="a.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3">
              <p class="font-medium text-gray-900">{{ a.title }}</p>
              <p v-if="a.body" class="mt-0.5 line-clamp-1 text-xs text-gray-400">
                {{ a.body }}
              </p>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">
              {{ AUDIENCE_LABELS[a.audience] }}
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_BADGES[a.status]"
              >
                {{ STATUS_LABELS[a.status] }}
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">
              {{ a.authorName ?? '—' }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
              <template v-if="a.status === 'scheduled' && a.scheduledFor">
                <span class="text-blue-700">⏳ {{ fmtDate(a.scheduledFor) }}</span>
              </template>
              <template v-else>{{ fmtDate(a.publishedAt) }}</template>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
              {{ fmtDate(a.createdAt) }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-wrap justify-end gap-3 text-xs">
                <button
                  v-if="canPublish && (a.status === 'draft' || a.status === 'scheduled')"
                  class="font-medium text-green-700 hover:underline"
                  @click="publishAnnouncement(a)"
                >
                  Publish
                </button>
                <button
                  v-if="canPublish && a.status === 'published'"
                  class="font-medium text-yellow-700 hover:underline"
                  @click="archiveAnnouncement(a)"
                >
                  Archive
                </button>
                <button
                  v-if="canUpdate && (a.status === 'draft' || a.status === 'scheduled')"
                  class="text-gray-600 hover:underline"
                  @click="openEdit(a)"
                >
                  Edit
                </button>
                <button
                  v-if="canUpdate && a.status === 'draft'"
                  class="text-red-700 hover:underline"
                  @click="deleteAnnouncement(a)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > 0" class="flex items-center justify-between text-sm text-gray-600">
      <span>{{ total }} announcement(s) · page {{ page }} of {{ lastPage }}</span>
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

    <!-- Create / edit announcement -->
    <BaseModal
      :open="formModalOpen"
      :title="editingId ? 'Edit announcement' : 'New announcement'"
      wide
      @close="formModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitForm">
        <p v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Title *</span>
          <input
            v-model="form.title"
            required
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Body</span>
          <textarea
            v-model="form.body"
            rows="6"
            maxlength="20000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Audience</span>
            <select
              v-model="form.audience"
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
              v-model="form.status"
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
        <label v-if="form.status === 'scheduled'" class="block text-sm">
          <span class="block font-medium text-gray-700">Publish at (local time) *</span>
          <input
            v-model="form.scheduledFor"
            type="datetime-local"
            required
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 sm:w-72"
          />
          <span class="mt-1 block text-xs text-gray-500">
            Published automatically by the 5-minute scheduled job at/after this time.
          </span>
        </label>
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
            {{ formSaving ? 'Saving…' : 'Save announcement' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
