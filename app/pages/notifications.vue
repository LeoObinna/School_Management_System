<script setup lang="ts">
import { notificationsApi } from '~/services/communication'
import { formatApiError } from '~/utils/errors'
import type { Notification } from '~/shared/types'

definePageMeta({ permissions: ['notifications.view'] })

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const items = ref<Notification[]>([])
const page = ref(1)
const perPage = ref(20)
const total = ref(0)
const lastPage = ref(1)
const statusFilter = ref<'unread' | 'read' | undefined>(undefined)

const STATUS_BADGES: Record<string, string> = {
  unread: 'bg-blue-100 text-blue-700',
  read: 'bg-gray-100 text-gray-700',
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const result = await notificationsApi.list({
      page: page.value,
      perPage: perPage.value,
      status: statusFilter.value,
    })
    items.value = result.data
    total.value = result.meta.total
    lastPage.value = result.meta.lastPage
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function markRead(id: string) {
  try {
    await notificationsApi.markRead(id)
    await load()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function markAllRead() {
  try {
    const result = await notificationsApi.markAllRead()
    notice.value = `Marked ${result.updated} notifications as read.`
    await load()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function del(id: string) {
  if (!confirm('Delete this notification?')) return
  try {
    await notificationsApi.del(id)
    await load()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

onMounted(load)
watch([page, perPage, statusFilter], () => {
  if (page.value !== 1) page.value = 1
  else load()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Notifications</h1>
      <div class="flex gap-2">
        <select
          v-model="statusFilter"
          class="rounded-lg border px-3 py-2 text-sm"
        >
          <option :value="undefined">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <button
          v-if="items.some((n) => n.status === 'unread')"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          @click="markAllRead"
        >
          Mark all read
        </button>
      </div>
    </div>

    <div
      v-if="notice"
      class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700"
    >
      {{ notice }}
    </div>
    <div
      v-if="loadError"
      class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-500">
      Loading…
    </div>
    <div v-else-if="items.length === 0" class="py-8 text-center text-gray-500">
      No notifications.
    </div>
    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Title</th>
            <th class="px-4 py-3 text-left font-medium">Status</th>
            <th class="px-4 py-3 text-left font-medium">Date</th>
            <th class="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="item in items" :key="item.id">
            <td class="px-4 py-3">
              <div class="font-medium">{{ item.title }}</div>
              <div v-if="item.body" class="text-gray-500 line-clamp-2">
                {{ item.body }}
              </div>
              <a
                v-if="item.link"
                :href="item.link"
                class="text-blue-600 hover:underline"
              >
                View
              </a>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-1 text-xs font-medium"
                :class="STATUS_BADGES[item.status]"
              >
                {{ item.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-500">
              {{ new Date(item.createdAt).toLocaleDateString() }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="item.status === 'unread'"
                class="text-blue-600 hover:underline"
                @click="markRead(item.id)"
              >
                Mark read
              </button>
              <button
                class="ml-3 text-red-600 hover:underline"
                @click="del(item.id)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="lastPage > 1"
      class="mt-4 flex items-center justify-between"
    >
      <button
        :disabled="page <= 1"
        class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        @click="page--"
      >
        Previous
      </button>
      <span class="text-sm text-gray-500">
        Page {{ page }} of {{ lastPage }} ({{ total }} total)
      </span>
      <button
        :disabled="page >= lastPage"
        class="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        @click="page++"
      >
        Next
      </button>
    </div>
  </div>
</template>
