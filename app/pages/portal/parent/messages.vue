<script setup lang="ts">
/**
 * Parent portal — messages to teachers (Phase 16B). Recipient picker is
 * powered by GET /parents/me/teachers (only the parent's children's
 * teachers); sending/inbox reuse the existing /api/v1/messages
 * endpoints with their server-side authorization.
 */
import { messagesApi } from '~/services/communication'
import { parentsApi } from '~/services/parents'
import { formatApiError } from '~/utils/errors'
import type {
  MessageListItem,
  ParentTeacherContact,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['messages.send'] })

const teachers = ref<ParentTeacherContact[]>([])
const inbox = ref<MessageListItem[]>([])
const sent = ref<MessageListItem[]>([])
const loading = ref(true)
const listLoading = ref(false)
const error = ref<string | null>(null)
const sendError = ref<string | null>(null)
const sendBusy = ref(false)
const box = ref<'inbox' | 'sent'>('inbox')

const recipientId = ref('')
const subject = ref('')
const body = ref('')

const messagableTeachers = computed(() =>
  teachers.value.filter((t) => t.userId !== null),
)

const visible = computed(() => (box.value === 'inbox' ? inbox.value : sent.value))

function teacherLabel(t: ParentTeacherContact): string {
  const role = t.isPrimaryTeacher ? 'Class teacher' : 'Subject teacher'
  return `${t.name} — ${role}, ${t.className}${
    t.subjectName && !t.isPrimaryTeacher ? ` (${t.subjectName})` : ''
  }`
}

function fmtDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
}

async function loadBoxes() {
  listLoading.value = true
  try {
    const [inRes, outRes] = await Promise.all([
      messagesApi.list({ direction: 'inbound', page: 1, perPage: 50 }),
      messagesApi.list({ direction: 'outbound', page: 1, perPage: 50 }),
    ])
    inbox.value = inRes.data
    sent.value = outRes.data
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    listLoading.value = false
  }
}

async function send() {
  sendError.value = null
  if (!recipientId.value) {
    sendError.value = 'Choose a teacher to message.'
    return
  }
  if (!body.value.trim()) {
    sendError.value = 'Write a message first.'
    return
  }
  sendBusy.value = true
  try {
    await messagesApi.send({
      recipientId: recipientId.value,
      ...(subject.value.trim() ? { subject: subject.value.trim() } : {}),
      body: body.value.trim(),
    })
    body.value = ''
    subject.value = ''
    box.value = 'sent'
    await loadBoxes()
  } catch (e) {
    sendError.value = formatApiError(e)
  } finally {
    sendBusy.value = false
  }
}

async function markRead(message: MessageListItem) {
  if (box.value !== 'inbox' || message.isRead) return
  try {
    await messagesApi.markRead(message.id)
    message.isRead = true
  } catch {
    // Best-effort; the badge refreshes on next load.
  }
}

onMounted(async () => {
  try {
    const [teacherRes] = await Promise.all([parentsApi.listMyTeachers()])
    teachers.value = teacherRes.data
    await loadBoxes()
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
        Messages
      </h1>
      <p class="mt-1 text-sm text-text-secondary">
        Contact your children's teachers. Replies appear in your inbox.
      </p>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading messages…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <template v-else>
      <!-- Composer -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">New message</h2>
        <p v-if="messagableTeachers.length === 0" class="mt-3 text-sm text-text-muted">
          No teachers are assigned to your children's classes yet.
        </p>
        <form v-else class="mt-4 space-y-4" @submit.prevent="send">
          <label class="block text-sm">
            <span class="text-text-secondary">Teacher</span>
            <select
              v-model="recipientId"
              class="mt-1 w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
            >
              <option value="" disabled>Select a teacher…</option>
              <option
                v-for="t in messagableTeachers"
                :key="t.teacherId"
                :value="t.userId"
              >
                {{ teacherLabel(t) }}
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-text-secondary">Subject (optional)</span>
            <input
              v-model="subject"
              type="text"
              maxlength="255"
              class="mt-1 w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
            >
          </label>
          <label class="block text-sm">
            <span class="text-text-secondary">Message</span>
            <textarea
              v-model="body"
              rows="4"
              required
              class="mt-1 w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
            />
          </label>
          <p
            v-if="sendError"
            class="rounded-md bg-red-50 p-2 text-sm text-red-700"
            role="alert"
          >
            {{ sendError }}
          </p>
          <button
            type="submit"
            :disabled="sendBusy"
            class="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
          >
            {{ sendBusy ? 'Sending…' : 'Send message' }}
          </button>
        </form>
      </section>

      <!-- Inbox / sent -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm"
            :class="
              box === 'inbox'
                ? 'bg-surface-muted font-medium text-brand-primary'
                : 'text-text-secondary hover:bg-surface-muted'
            "
            @click="box = 'inbox'"
          >
            Inbox ({{ inbox.filter((m) => !m.isRead).length }})
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm"
            :class="
              box === 'sent'
                ? 'bg-surface-muted font-medium text-brand-primary'
                : 'text-text-secondary hover:bg-surface-muted'
            "
            @click="box = 'sent'"
          >
            Sent
          </button>
        </div>

        <p v-if="listLoading" class="mt-4 text-sm text-text-muted" role="status">
          Loading…
        </p>
        <p
          v-else-if="visible.length === 0"
          class="mt-4 text-sm text-text-muted"
        >
          {{ box === 'inbox' ? 'No messages received yet.' : 'No messages sent yet.' }}
        </p>
        <ul v-else class="mt-4 divide-y divide-border-default">
          <li
            v-for="message in visible"
            :key="message.id"
            class="cursor-pointer py-3"
            @click="markRead(message)"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-sm font-medium text-text-primary">
                <span
                  v-if="box === 'inbox' && !message.isRead"
                  class="mr-2 inline-block h-2 w-2 rounded-full bg-brand-primary align-middle"
                  aria-label="Unread"
                />
                {{ message.subject ?? '(no subject)' }}
              </p>
              <p class="text-xs text-text-muted">
                {{ fmtDate(message.createdAt) }}
              </p>
            </div>
            <p class="mt-0.5 text-xs text-text-muted">
              {{ box === 'inbox' ? message.senderName ?? 'Unknown' : message.recipientName ?? 'Unknown' }}
            </p>
            <p class="mt-1 line-clamp-2 text-sm text-text-secondary">
              {{ message.body }}
            </p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
