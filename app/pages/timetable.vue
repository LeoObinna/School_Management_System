<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { peopleApi } from '~/services/people'
import { scheduleApi } from '~/services/schedule'
import { formatApiError } from '~/utils/errors'
import { WEEKDAYS } from '~/shared/schemas'
import type {
  AcademicSession,
  SchoolClass,
  Section,
  Subject,
  Teacher,
  TimetableEntryDetail,
  Term,
  Weekday,
} from '~/shared/types'

definePageMeta({ permissions: ['timetable.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('timetable.manage'))

const loading = ref(false)
const loadError = ref<string | null>(null)
const entries = ref<TimetableEntryDetail[]>([])

const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const classes = ref<SchoolClass[]>([])
const sections = ref<Section[]>([])
const subjects = ref<Subject[]>([])
const teachers = ref<Teacher[]>([])

const sessionId = ref('')
const classId = ref('')
const teacherId = ref('')

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

async function loadBase() {
  const [sessPage, classPage, subjectPage, teacherPage] = await Promise.all([
    academicsApi.listSessions({ perPage: 100 }),
    academicsApi.listClasses({ perPage: 100, isActive: true }),
    academicsApi.listSubjects({ perPage: 200, isActive: true }),
    peopleApi.listTeachers({ perPage: 500, isActive: true }),
  ])
  sessions.value = sessPage.data
  classes.value = classPage.data
  subjects.value = subjectPage.data
  teachers.value = teacherPage.data
  sessionId.value = sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
  await Promise.all([loadTerms(), loadEntries()])
}

async function loadTerms() {
  terms.value = []
  if (!sessionId.value) {
    return
  }
  const page = await academicsApi.listTerms({ sessionId: sessionId.value, perPage: 50 })
  terms.value = page.data
}

async function loadEntries() {
  loading.value = true
  loadError.value = null
  try {
    const res = await scheduleApi.listTimetable({
      perPage: 500,
      sessionId: sessionId.value || undefined,
      classId: classId.value || undefined,
      teacherId: teacherId.value || undefined,
    })
    entries.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(sessionId, async () => {
  await loadTerms()
  await loadEntries()
})

const byWeekday = computed<Record<Weekday, TimetableEntryDetail[]>>(() => {
  const grouped = Object.fromEntries(WEEKDAYS.map((d) => [d, [] as TimetableEntryDetail[]])) as Record<Weekday, TimetableEntryDetail[]>
  for (const entry of entries.value) {
    grouped[entry.weekday].push(entry)
  }
  for (const day of WEEKDAYS) {
    grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }
  return grouped
})

// --- Create / edit modal ---------------------------------------------------
const modalOpen = ref(false)
const editing = ref<TimetableEntryDetail | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  sessionId: '',
  termId: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  teacherId: '',
  room: '',
  weekday: 'monday' as Weekday,
  startTime: '08:00',
  endTime: '08:45',
})

watch(
  () => form.classId,
  async (id) => {
    // Do not clear form.sectionId here: programmatic prefills (edit)
    // set both together. Manual changes clear it via @change instead.
    if (!id) {
      sections.value = []
      return
    }
    try {
      const detail = await academicsApi.getClass(id)
      sections.value = detail.sections
    } catch {
      /* optional */
    }
  },
)

function openCreate() {
  editing.value = null
  formError.value = null
  Object.assign(form, {
    sessionId: sessionId.value || sessions.value[0]?.id || '',
    termId: '',
    classId: classId.value || '',
    sectionId: '',
    subjectId: '',
    teacherId: '',
    room: '',
    weekday: 'monday',
    startTime: '08:00',
    endTime: '08:45',
  })
  modalOpen.value = true
}

function openEdit(entry: TimetableEntryDetail) {
  editing.value = entry
  formError.value = null
  Object.assign(form, {
    sessionId: entry.sessionId,
    termId: entry.termId ?? '',
    classId: entry.classId,
    sectionId: entry.sectionId ?? '',
    subjectId: entry.subjectId,
    teacherId: entry.teacherId,
    room: entry.room ?? '',
    weekday: entry.weekday,
    startTime: entry.startTime.slice(0, 5),
    endTime: entry.endTime.slice(0, 5),
  })
  modalOpen.value = true
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    const body = {
      sessionId: form.sessionId,
      classId: form.classId,
      subjectId: form.subjectId,
      teacherId: form.teacherId,
      weekday: form.weekday,
      startTime: form.startTime,
      endTime: form.endTime,
      ...(form.termId ? { termId: form.termId } : { termId: null }),
      ...(form.sectionId ? { sectionId: form.sectionId } : { sectionId: null }),
      ...(form.room ? { room: form.room } : { room: null }),
    }
    if (editing.value) {
      await scheduleApi.updateTimetableEntry(editing.value.id, body)
    } else {
      await scheduleApi.createTimetableEntry(body)
    }
    modalOpen.value = false
    await loadEntries()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function remove(entry: TimetableEntryDetail) {
  if (!confirm(`Remove ${entry.subjectName} on ${WEEKDAY_LABELS[entry.weekday]}?`)) {
    return
  }
  try {
    await scheduleApi.removeTimetableEntry(entry.id)
    await loadEntries()
  } catch (e) {
    alert(formatApiError(e))
  }
}

onMounted(loadBase)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">← Dashboard</NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">Timetable</h1>
    </div>

    <div v-if="loadError" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ loadError }}
      <button type="button" class="ml-2 underline" @click="loadEntries">Retry</button>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-3">
        <select v-model="sessionId" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-model="classId" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="loadEntries">
          <option value="">All classes</option>
          <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
        </select>
        <select v-model="teacherId" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="loadEntries">
          <option value="">All teachers</option>
          <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.firstName }} {{ t.lastName }}</option>
        </select>
      </div>
      <button v-if="canManage" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="openCreate">New entry</button>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-500">Loading…</div>
    <div v-else-if="entries.length === 0" class="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
      No timetable entries for the selected filters.
    </div>
    <div v-else class="overflow-x-auto">
      <div class="grid min-w-[1100px] grid-cols-7 gap-2">
        <div v-for="day in WEEKDAYS" :key="day" class="rounded-lg bg-gray-100 p-2">
          <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{{ WEEKDAY_LABELS[day] }}</p>
          <div class="space-y-2">
            <div
              v-for="entry in byWeekday[day]"
              :key="entry.id"
              class="rounded-md border border-indigo-100 bg-white p-2 text-xs shadow-sm"
            >
              <p class="font-semibold text-indigo-700">{{ entry.startTime.slice(0, 5) }}–{{ entry.endTime.slice(0, 5) }}</p>
              <p class="mt-1 font-medium text-gray-900">{{ entry.subjectName }}</p>
              <p class="text-gray-600">{{ entry.className }}<span v-if="entry.sectionName"> / {{ entry.sectionName }}</span></p>
              <p class="mt-0.5 text-gray-500">{{ entry.teacherName }}</p>
              <p v-if="entry.room" class="text-gray-400">Room {{ entry.room }}</p>
              <p v-if="entry.termName" class="mt-0.5 text-gray-400">{{ entry.termName }}</p>
              <div v-if="canManage" class="mt-1 flex gap-2">
                <button type="button" class="text-indigo-600 hover:underline" @click="openEdit(entry)">Edit</button>
                <button type="button" class="text-red-600 hover:underline" @click="remove(entry)">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UiBaseModal :open="modalOpen" :title="editing ? 'Edit timetable entry' : 'New timetable entry'" @close="modalOpen = false">
      <form class="space-y-3" @submit.prevent="submit">
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Session</label>
            <select v-model="form.sessionId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Term (optional)</label>
            <select v-model="form.termId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Whole session</option>
              <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Class</label>
            <select v-model="form.classId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" @change="form.sectionId = ''">
              <option value="" disabled>Select a class</option>
              <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Section (optional)</label>
            <select v-model="form.sectionId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Whole class</option>
              <option v-for="sec in sections" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Subject</label>
            <select v-model="form.subjectId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Select a subject</option>
              <option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Teacher</label>
            <select v-model="form.teacherId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Select a teacher</option>
              <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.firstName }} {{ t.lastName }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Weekday</label>
            <select v-model="form.weekday" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option v-for="day in WEEKDAYS" :key="day" :value="day">{{ WEEKDAY_LABELS[day] }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Start</label>
            <input v-model="form.startTime" type="time" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">End</label>
            <input v-model="form.endTime" type="time" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Room (optional)</label>
          <input v-model="form.room" maxlength="100" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </form>
      <template #footer>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="modalOpen = false">Cancel</button>
        <button
          type="button"
          :disabled="saving || !form.sessionId || !form.classId || !form.subjectId || !form.teacherId || form.endTime <= form.startTime"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submit"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </template>
    </UiBaseModal>
  </div>
</template>
