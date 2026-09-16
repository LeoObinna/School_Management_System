<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { messagesApi } from '~/services/communication'
import { formatApiError } from '~/utils/errors'
import type { MessageListItem } from '~/shared/types'

definePageMeta({ permissions: ['messages.view'] })

const auth = useAuthStore()
const canSend = computed(() => auth.can('messages.send'))

// ---------------------------------------------------------------------------
// Inbox list
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const items = ref<MessageListItem[]>([])
const page = ref(1)
const perPage = 20
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const readFilter = ref<'all' | 'unread' | 'read'>('all')

const DIRECTION_LABELS: Record<string, string> = {
  inbound: 'Inbox',
  outbound: 'Sent',
}

const DIRECTION_BADGES: Record<string, string> = {
  inbound: 'bg-blue-50 text-blue-700',
  outbound: 'bg-gray-100 text-gray-700',
}

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const result = await messagesApi.list({
      page: page.value,
      perPage,
      isRead:
        readFilter.value === 'all' ? undefined : readFilter.value === 'read',
    })
    items.value = result.data
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

watch(readFilter, () => applyFilters())

onMounted(() => {
  void loadAll()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

async function markRead(id: string) {
  try {
    await messagesApi.markRead(id)
    await loadAll()
    if (selected.value?.id === id) {
      selected.value = await messagesApi.get(id)
    }
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

const detailOpen = ref(false)
const detailLoading = ref(false)
const selected = ref<MessageListItem | null>(null)

async function openDetail(row: MessageListItem) {
  detailOpen.value = true
  detailLoading.value = true
  selected.value = null
  try {
    const detail = await messagesApi.get(row.id)
    selected.value = detail
    if (!detail.isRead && detail.direction === 'inbound') {
      void markRead(detail.id)
    }
  } catch (e) {
    loadError.value = formatApiError(e)
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Compose modal
// ---------------------------------------------------------------------------

const composeOpen = ref(false)
const composeSaving = ref(false)
const composeError = ref<string | null>(null)
const composeForm = reactive({
  recipientEmail: '',
  subject: '',
  body: '',
})

function resetComposeForm() {
  Object.assign(composeForm, {
    recipientEmail: '',
    subject: '',
    body: '',
  })
}

function openCompose() {
  resetComposeForm()
  composeError.value = null
  composeOpen.value = true
}

async function submitCompose() {
  composeSaving.value = true
  composeError.value = null
  const body = {
    recipientEmail: composeForm.recipientEmail.trim(),
    subject: composeForm.subject.trim() || undefined,
    body: composeForm.body.trim(),
  }
  try {
    await messagesApi.send(body)
    notice.value = 'Message sent.'
    composeOpen.value = false
    await loadAll()
  } catch (e) {
    composeError.value = formatApiError(e)
  } finally {
    composeSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Messages</h1>
        <p class="mt-1 text-sm text-gray-500">
          Internal direct messages between users.
        </p>
      </div>
      <button
        v-if="canSend"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCompose"
      >
        Compose
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
    <div class="flex flex-wrap items-center gap-3">
      <label class="text-sm font-medium text-gray-700" for="msg-read-filter">
        View
      </label>
      <select
        id="msg-read-filter"
        v-model="readFilter"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="unread">Unread</option>
        <option value="read">Read</option>
      </select>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
    <div
      v-else-if="items.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"
    >
      No messages found.
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Subject</th>
            <th class="px-4 py-3 font-medium">Sender</th>
            <th class="px-4 py-3 font-medium">Direction</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Created</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="m in items"
            :key="m.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3">
              <button
                class="font-medium text-indigo-700 hover:underline"
                @click="openDetail(m)"
              >
                {{ m.subject || '(no subject)' }}
              </button>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-700">
              <div>{{ m.senderName || '—' }}</div>
              <div v-if="m.senderEmail" class="text-xs text-gray-400">
                {{ m.senderEmail }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="DIRECTION_BADGES[m.direction]"
              >
                {{ DIRECTION_LABELS[m.direction] }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="m.isRead ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-700'"
              >
                {{ m.isRead ? 'Read' : 'Unread' }}
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
              {{ fmtDateTime(m.createdAt) }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="!m.isRead && m.direction === 'inbound'"
                class="text-xs text-blue-700 hover:underline"
                @click="markRead(m.id)"
              >
                Mark read
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > 0" class="flex items-center justify-between text-sm text-gray-600">
      <span>{{ total }} message(s) · page {{ page }} of {{ lastPage }}</span>
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

    <!-- Detail -->
    <BaseModal
      :open="detailOpen"
      :title="selected ? selected.subject || '(no subject)' : 'Message'"
      wide
      @close="detailOpen = false"
    >
      <div v-if="detailLoading" class="text-sm text-gray-500">Loading…</div>
      <div v-else-if="selected" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
              From
            </p>
            <p class="text-gray-800">{{ selected.senderName || '—' }}</p>
            <p v-if="selected.senderEmail" class="text-xs text-gray-500">
              {{ selected.senderEmail }}
            </p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Direction
            </p>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="DIRECTION_BADGES[selected.direction]"
            >
              {{ DIRECTION_LABELS[selected.direction] }}
            </span>
          </div>
        </div>
        <div class="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm text-gray-700">
          {{ selected.body }}
        </div>
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>{{ fmtDateTime(selected.createdAt) }}</span>
          <button
            v-if="!selected.isRead && selected.direction === 'inbound'"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            @click="markRead(selected.id)"
          >
            Mark read
          </button>
        </div>
      </div>
    </BaseModal>

    <!-- Compose -->
    <BaseModal
      :open="composeOpen"
      title="New message"
      @close="composeOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitCompose">
        <p v-if="composeError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ composeError }}
        </p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Recipient email *</span>
          <input
            v-model="composeForm.recipientEmail"
            type="email"
            required
            maxlength="255"
            placeholder="recipient@school.com"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Subject</span>
          <input
            v-model="composeForm.subject"
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Message *</span>
          <textarea
            v-model="composeForm.body"
            required
            rows="6"
            maxlength="20000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            @click="composeOpen = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="composeSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ composeSaving ? 'Sending…' : 'Send message' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
