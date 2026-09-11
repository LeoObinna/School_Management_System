<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type { AcademicSession, Term } from '~/shared/types'

definePageMeta({ permissions: ['academic_sessions.view'] })

const auth = useAuthStore()
const canManageSessions = computed(() => auth.can('academic_sessions.manage'))
const canManageTerms = computed(() => auth.can('terms.manage'))

const tab = ref<'sessions' | 'terms'>('sessions')

// --- Sessions -------------------------------------------------------------
const sessionPage = usePaginated<AcademicSession>(academicsApi.listSessions)
const {
  items: sessionsItems,
  total: sessionsTotal,
  loading: sessionsLoading,
  error: sessionsError,
} = sessionPage

const sessionModalOpen = ref(false)
const editingSession = ref<AcademicSession | null>(null)
const sessionSaving = ref(false)
const sessionFormError = ref<string | null>(null)
const sessionForm = reactive({
  name: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
})

async function loadSessions() {
  await sessionPage.load({ perPage: 100 })
}

function openSessionCreate() {
  editingSession.value = null
  sessionFormError.value = null
  Object.assign(sessionForm, {
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
  })
  sessionModalOpen.value = true
}

function openSessionEdit(session: AcademicSession) {
  editingSession.value = session
  sessionFormError.value = null
  Object.assign(sessionForm, {
    name: session.name,
    startDate: session.startDate ?? '',
    endDate: session.endDate ?? '',
    isCurrent: session.isCurrent,
  })
  sessionModalOpen.value = true
}

async function submitSession() {
  sessionSaving.value = true
  sessionFormError.value = null
  try {
    const body = {
      name: sessionForm.name,
      ...(sessionForm.startDate ? { startDate: sessionForm.startDate } : {}),
      ...(sessionForm.endDate ? { endDate: sessionForm.endDate } : {}),
      isCurrent: sessionForm.isCurrent,
    }
    if (editingSession.value) {
      await academicsApi.updateSession(editingSession.value.id, body)
    } else {
      await academicsApi.createSession(body)
    }
    sessionModalOpen.value = false
    await loadSessions()
  } catch (e) {
    sessionFormError.value = formatApiError(e)
  } finally {
    sessionSaving.value = false
  }
}

async function makeSessionCurrent(session: AcademicSession) {
  try {
    await academicsApi.updateSession(session.id, { isCurrent: true })
    await loadSessions()
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function deactivateSession(session: AcademicSession) {
  if (!confirm(`Deactivate session "${session.name}"? Historical records are kept.`)) {
    return
  }
  try {
    await academicsApi.deactivateSession(session.id)
    await loadSessions()
  } catch (e) {
    alert(formatApiError(e))
  }
}

// --- Terms ----------------------------------------------------------------
const termPage = usePaginated<Term>(academicsApi.listTerms)
const {
  items: termsItems,
  loading: termsLoading,
  error: termsError,
} = termPage
const termSessionFilter = ref<string>('')

const termModalOpen = ref(false)
const editingTerm = ref<Term | null>(null)
const termSaving = ref(false)
const termFormError = ref<string | null>(null)
const termForm = reactive({
  sessionId: '',
  name: '',
  sequence: 1,
  startDate: '',
  endDate: '',
  isCurrent: false,
})

async function loadTerms() {
  await termPage.load({
    perPage: 100,
    ...(termSessionFilter.value ? { sessionId: termSessionFilter.value } : {}),
  })
}

watch(tab, async (value) => {
  if (value === 'terms') {
    if (sessionsItems.value.length === 0) {
      await loadSessions()
    }
    await loadTerms()
  }
})

function openTermCreate() {
  editingTerm.value = null
  termFormError.value = null
  const currentSession =
    sessionsItems.value.find((s) => s.isCurrent) ?? sessionsItems.value[0]
  Object.assign(termForm, {
    sessionId: termSessionFilter.value || currentSession?.id || '',
    name: '',
    sequence: termsItems.value.length + 1,
    startDate: '',
    endDate: '',
    isCurrent: false,
  })
  termModalOpen.value = true
}

function openTermEdit(term: Term) {
  editingTerm.value = term
  termFormError.value = null
  Object.assign(termForm, {
    sessionId: term.sessionId,
    name: term.name,
    sequence: term.sequence,
    startDate: term.startDate ?? '',
    endDate: term.endDate ?? '',
    isCurrent: term.isCurrent,
  })
  termModalOpen.value = true
}

async function submitTerm() {
  termSaving.value = true
  termFormError.value = null
  try {
    const body = {
      sessionId: termForm.sessionId,
      name: termForm.name,
      sequence: Number(termForm.sequence),
      ...(termForm.startDate ? { startDate: termForm.startDate } : {}),
      ...(termForm.endDate ? { endDate: termForm.endDate } : {}),
      isCurrent: termForm.isCurrent,
    }
    if (editingTerm.value) {
      await academicsApi.updateTerm(editingTerm.value.id, body)
    } else {
      await academicsApi.createTerm(body)
    }
    termModalOpen.value = false
    await loadTerms()
  } catch (e) {
    termFormError.value = formatApiError(e)
  } finally {
    termSaving.value = false
  }
}

async function makeTermCurrent(term: Term) {
  try {
    await academicsApi.updateTerm(term.id, { isCurrent: true })
    await loadTerms()
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function deactivateTerm(term: Term) {
  if (!confirm(`Deactivate term "${term.name}"?`)) {
    return
  }
  try {
    await academicsApi.deactivateTerm(term.id)
    await loadTerms()
  } catch (e) {
    alert(formatApiError(e))
  }
}

function sessionName(id: string): string {
  return sessionsItems.value.find((s) => s.id === id)?.name ?? '—'
}

onMounted(loadSessions)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">
        ← Dashboard
      </NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">
        Sessions &amp; terms
      </h1>
    </div>

    <div class="mb-6 inline-flex rounded-lg border border-gray-200 bg-white p-1">
      <button
        type="button"
        class="rounded-md px-4 py-1.5 text-sm font-medium"
        :class="tab === 'sessions' ? 'bg-indigo-600 text-white' : 'text-gray-600'"
        @click="tab = 'sessions'"
      >
        Academic sessions
      </button>
      <button
        type="button"
        class="rounded-md px-4 py-1.5 text-sm font-medium"
        :class="tab === 'terms' ? 'bg-indigo-600 text-white' : 'text-gray-600'"
        @click="tab = 'terms'"
      >
        Terms
      </button>
    </div>

    <!-- Sessions tab -->
    <section v-if="tab === 'sessions'">
      <div class="mb-4 flex items-center justify-between">
        <p class="text-sm text-gray-500">{{ sessionsTotal }} session(s)</p>
        <button
          v-if="canManageSessions"
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openSessionCreate"
        >
          New session
        </button>
      </div>

      <div
        v-if="sessionsError"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {{ sessionsError }}
        <button type="button" class="ml-2 underline" @click="loadSessions">Retry</button>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Start</th>
              <th class="px-4 py-3">End</th>
              <th class="px-4 py-3">Current</th>
              <th class="px-4 py-3">Status</th>
              <th v-if="canManageSessions" class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="sessionsLoading">
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">Loading…</td>
            </tr>
            <tr v-else-if="sessionsItems.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                No academic sessions yet.
              </td>
            </tr>
            <tr v-for="session in sessionsItems" v-else :key="session.id">
              <td class="px-4 py-3 font-medium text-gray-900">{{ session.name }}</td>
              <td class="px-4 py-3 text-gray-600">{{ session.startDate || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ session.endDate || '—' }}</td>
              <td class="px-4 py-3">
                <span
                  v-if="session.isCurrent"
                  class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                >Current</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="session.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                >{{ session.isActive ? 'Active' : 'Inactive' }}</span>
              </td>
              <td v-if="canManageSessions" class="px-4 py-3 text-right">
                <button
                  v-if="!session.isCurrent && session.isActive"
                  type="button"
                  class="mr-3 text-indigo-600 hover:underline"
                  @click="makeSessionCurrent(session)"
                >Make current</button>
                <button
                  type="button"
                  class="mr-3 text-indigo-600 hover:underline"
                  @click="openSessionEdit(session)"
                >Edit</button>
                <button
                  v-if="session.isActive"
                  type="button"
                  class="text-red-600 hover:underline"
                  @click="deactivateSession(session)"
                >Deactivate</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Terms tab -->
    <section v-else>
      <div class="mb-4 flex items-center justify-between gap-4">
        <select
          v-model="termSessionFilter"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          @change="loadTerms"
        >
          <option value="">All sessions</option>
          <option v-for="session in sessionsItems" :key="session.id" :value="session.id">
            {{ session.name }}
          </option>
        </select>
        <button
          v-if="canManageTerms"
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openTermCreate"
        >
          New term
        </button>
      </div>

      <div
        v-if="termsError"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {{ termsError }}
        <button type="button" class="ml-2 underline" @click="loadTerms">Retry</button>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-3">#</th>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Session</th>
              <th class="px-4 py-3">Start</th>
              <th class="px-4 py-3">End</th>
              <th class="px-4 py-3">Current</th>
              <th v-if="canManageTerms" class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="termsLoading">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">Loading…</td>
            </tr>
            <tr v-else-if="termsItems.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">No terms yet.</td>
            </tr>
            <tr v-for="term in termsItems" v-else :key="term.id">
              <td class="px-4 py-3 text-gray-600">{{ term.sequence }}</td>
              <td class="px-4 py-3 font-medium text-gray-900">{{ term.name }}</td>
              <td class="px-4 py-3 text-gray-600">{{ sessionName(term.sessionId) }}</td>
              <td class="px-4 py-3 text-gray-600">{{ term.startDate || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ term.endDate || '—' }}</td>
              <td class="px-4 py-3">
                <span
                  v-if="term.isCurrent"
                  class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                >Current</span>
              </td>
              <td v-if="canManageTerms" class="px-4 py-3 text-right">
                <button
                  v-if="!term.isCurrent"
                  type="button"
                  class="mr-3 text-indigo-600 hover:underline"
                  @click="makeTermCurrent(term)"
                >Make current</button>
                <button
                  type="button"
                  class="mr-3 text-indigo-600 hover:underline"
                  @click="openTermEdit(term)"
                >Edit</button>
                <button
                  v-if="term.isActive"
                  type="button"
                  class="text-red-600 hover:underline"
                  @click="deactivateTerm(term)"
                >Deactivate</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Session modal -->
    <UiBaseModal
      :open="sessionModalOpen"
      :title="editingSession ? 'Edit session' : 'New session'"
      @close="sessionModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitSession">
        <div v-if="sessionFormError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ sessionFormError }}
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <input
            v-model="sessionForm.name"
            required
            maxlength="100"
            placeholder="2026/2027"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Start date</label>
            <input v-model="sessionForm.startDate" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">End date</label>
            <input v-model="sessionForm.endDate" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
          <input v-model="sessionForm.isCurrent" type="checkbox" class="rounded" />
          Set as current session
        </label>
      </form>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="sessionModalOpen = false"
        >Cancel</button>
        <button
          type="button"
          :disabled="sessionSaving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submitSession"
        >{{ sessionSaving ? 'Saving…' : 'Save' }}</button>
      </template>
    </UiBaseModal>

    <!-- Term modal -->
    <UiBaseModal
      :open="termModalOpen"
      :title="editingTerm ? 'Edit term' : 'New term'"
      @close="termModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitTerm">
        <div v-if="termFormError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ termFormError }}
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Session</label>
          <select
            v-model="termForm.sessionId"
            required
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a session</option>
            <option v-for="session in sessionsItems" :key="session.id" :value="session.id">
              {{ session.name }}
            </option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Name</label>
            <input v-model="termForm.name" required maxlength="100" placeholder="First Term" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Sequence</label>
            <input v-model.number="termForm.sequence" type="number" min="1" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Start date</label>
            <input v-model="termForm.startDate" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">End date</label>
            <input v-model="termForm.endDate" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
          <input v-model="termForm.isCurrent" type="checkbox" class="rounded" />
          Set as current term in this session
        </label>
      </form>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="termModalOpen = false"
        >Cancel</button>
        <button
          type="button"
          :disabled="termSaving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submitTerm"
        >{{ termSaving ? 'Saving…' : 'Save' }}</button>
      </template>
    </UiBaseModal>
  </div>
</template>
