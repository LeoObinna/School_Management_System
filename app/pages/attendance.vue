<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { peopleApi } from '~/services/people'
import { scheduleApi } from '~/services/schedule'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  AttendanceReportRow,
  AttendanceSessionListItem,
  AttendanceStatus,
  SchoolClass,
  Section,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['attendance.view'] })

const auth = useAuthStore()
const canMark = computed(() => auth.can('attendance.mark'))
const canUpdate = computed(() => auth.can('attendance.update'))
const canApprove = computed(() => auth.can('attendance.approve'))

const tab = ref<'registers' | 'report'>('registers')
const sessions = ref<AcademicSession[]>([])
const classes = ref<SchoolClass[]>([])

const filterSessionId = ref('')
const filterClassId = ref('')
const filterStatus = ref('')

const { items, total, loading, error, load } =
  usePaginated<AttendanceSessionListItem>(scheduleApi.listSessions)

async function refreshSessions() {
  await load({
    perPage: 100,
    sessionId: filterSessionId.value || undefined,
    classId: filterClassId.value || undefined,
    status: filterStatus.value || undefined,
  })
}

async function loadFilterOptions() {
  const [sessPage, classPage] = await Promise.all([
    academicsApi.listSessions({ perPage: 100 }),
    academicsApi.listClasses({ perPage: 100, isActive: true }),
  ])
  sessions.value = sessPage.data
  classes.value = classPage.data
  filterSessionId.value =
    sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
  await refreshSessions()
}

const STATUS_BADGES: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
}

// --- Create register modal -------------------------------------------------
const createOpen = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const createForm = reactive({
  sessionId: '',
  termId: '',
  classId: '',
  sectionId: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
})
const createTerms = ref<Term[]>([])
const createSections = ref<Section[]>([])

watch(
  () => createForm.sessionId,
  async (id) => {
    createTerms.value = []
    createForm.termId = ''
    if (id) {
      const page = await academicsApi.listTerms({ sessionId: id, perPage: 50 })
      createTerms.value = page.data
    }
  },
)
watch(
  () => createForm.classId,
  async (id) => {
    createSections.value = []
    if (id) {
      try {
        const detail = await academicsApi.getClass(id)
        createSections.value = detail.sections
      } catch {
        /* optional */
      }
    }
  },
)

function openCreate() {
  createError.value = null
  Object.assign(createForm, {
    sessionId: filterSessionId.value || sessions.value[0]?.id || '',
    termId: '',
    classId: filterClassId.value || '',
    sectionId: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  createOpen.value = true
}

async function submitCreate() {
  creating.value = true
  createError.value = null
  try {
    await scheduleApi.createSession({
      sessionId: createForm.sessionId,
      classId: createForm.classId,
      date: createForm.date,
      ...(createForm.termId ? { termId: createForm.termId } : {}),
      ...(createForm.sectionId ? { sectionId: createForm.sectionId } : {}),
      ...(createForm.notes ? { notes: createForm.notes } : {}),
    })
    createOpen.value = false
    await refreshSessions()
  } catch (e) {
    createError.value = formatApiError(e)
  } finally {
    creating.value = false
  }
}

// --- Marking modal ---------------------------------------------------------
interface MarkRow {
  studentId: string
  studentName: string
  status: AttendanceStatus
  remark: string
}

const markOpen = ref(false)
const markSaving = ref(false)
const markError = ref<string | null>(null)
const markSession = ref<AttendanceSessionListItem | null>(null)
const markRows = ref<MarkRow[]>([])

async function openMark(row: AttendanceSessionListItem) {
  markError.value = null
  markOpen.value = true
  markSaving.value = true
  markSession.value = row
  markRows.value = []
  try {
    const [detail, enrollRes] = await Promise.all([
      scheduleApi.getSession(row.id),
      peopleApi.listEnrollments({
        perPage: 500,
        sessionId: row.sessionId,
        classId: row.classId,
        status: 'active',
      }),
    ])
    const rows: MarkRow[] = enrollRes.data.map((e) => {
      const existing = detail.records.find((r) => r.studentId === e.studentId)
      return {
        studentId: e.studentId,
        studentName: e.studentName,
        status: existing?.status ?? 'present',
        remark: existing?.remark ?? '',
      }
    })
    // Keep records for students who are no longer actively enrolled.
    const known = new Set(rows.map((r) => r.studentId))
    for (const record of detail.records) {
      if (!known.has(record.studentId)) {
        rows.push({
          studentId: record.studentId,
          studentName: record.studentName,
          status: record.status,
          remark: record.remark ?? '',
        })
      }
    }
    rows.sort((a, b) => a.studentName.localeCompare(b.studentName))
    markRows.value = rows
  } catch (e) {
    markError.value = formatApiError(e)
  } finally {
    markSaving.value = false
  }
}

async function saveMarks() {
  if (!markSession.value) {
    return
  }
  markSaving.value = true
  markError.value = null
  try {
    const updated = await scheduleApi.markAttendance(markSession.value.id, {
      records: markRows.value.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        ...(r.remark ? { remark: r.remark } : {}),
      })),
    })
    markSession.value = { ...markSession.value, status: updated.status }
    await refreshSessions()
  } catch (e) {
    markError.value = formatApiError(e)
  } finally {
    markSaving.value = false
  }
}

async function submitRegister() {
  if (!markSession.value) {
    return
  }
  try {
    const updated = await scheduleApi.submitSession(markSession.value.id)
    markSession.value = { ...markSession.value, status: updated.status }
    await refreshSessions()
  } catch (e) {
    markError.value = formatApiError(e)
  }
}

async function approveRegister() {
  if (!markSession.value) {
    return
  }
  try {
    const updated = await scheduleApi.approveSession(markSession.value.id)
    markSession.value = { ...markSession.value, status: updated.status }
    await refreshSessions()
  } catch (e) {
    markError.value = formatApiError(e)
  }
}

async function deleteRegister(row: AttendanceSessionListItem) {
  if (!confirm(`Delete the register for ${row.date}?`)) {
    return
  }
  try {
    await scheduleApi.removeSession(row.id)
    await refreshSessions()
  } catch (e) {
    alert(formatApiError(e))
  }
}

// --- Report tab ------------------------------------------------------------
const reportLoading = ref(false)
const reportError = ref<string | null>(null)
const reportRows = ref<AttendanceReportRow[]>([])
const reportLoaded = ref(false)
const reportForm = reactive({
  sessionId: '',
  termId: '',
  classId: '',
  sectionId: '',
})
const reportTerms = ref<Term[]>([])
const reportSections = ref<Section[]>([])

watch(
  () => reportForm.sessionId,
  async (id) => {
    reportTerms.value = []
    reportForm.termId = ''
    if (id) {
      const page = await academicsApi.listTerms({ sessionId: id, perPage: 50 })
      reportTerms.value = page.data
    }
  },
)
watch(
  () => reportForm.classId,
  async (id) => {
    reportSections.value = []
    reportForm.sectionId = ''
    if (id) {
      try {
        const detail = await academicsApi.getClass(id)
        reportSections.value = detail.sections
      } catch {
        /* optional */
      }
    }
  },
)

function initReportFilters() {
  if (reportForm.sessionId) {
    return
  }
  Object.assign(reportForm, {
    sessionId: filterSessionId.value || sessions.value[0]?.id || '',
    classId: filterClassId.value || '',
    termId: '',
    sectionId: '',
  })
}

async function loadReport() {
  if (!reportForm.sessionId || !reportForm.classId) {
    return
  }
  reportLoading.value = true
  reportError.value = null
  try {
    const res = await scheduleApi.classReport({
      sessionId: reportForm.sessionId,
      classId: reportForm.classId,
      ...(reportForm.termId ? { termId: reportForm.termId } : {}),
      ...(reportForm.sectionId ? { sectionId: reportForm.sectionId } : {}),
    })
    reportRows.value = res.data
    reportLoaded.value = true
  } catch (e) {
    reportError.value = formatApiError(e)
  } finally {
    reportLoading.value = false
  }
}

watch(tab, (value) => {
  if (value === 'report') {
    initReportFilters()
  }
})

onMounted(loadFilterOptions)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">← Dashboard</NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">Attendance</h1>
    </div>

    <div class="mb-4 flex gap-2">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium"
        :class="tab === 'registers' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300'"
        @click="tab = 'registers'"
      >
        Registers
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium"
        :class="tab === 'report' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300'"
        @click="tab = 'report'"
      >
        Class report
      </button>
    </div>

    <!-- Registers -->
    <div v-if="tab === 'registers'">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-3">
          <select v-model="filterSessionId" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="refreshSessions">
            <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <select v-model="filterClassId" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="refreshSessions">
            <option value="">All classes</option>
            <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
          </select>
          <select v-model="filterStatus" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="refreshSessions">
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        <button v-if="canMark" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="openCreate">New register</button>
      </div>

      <div v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
        <button type="button" class="ml-2 underline" @click="refreshSessions">Retry</button>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Class / section</th>
              <th class="px-4 py-3">Term</th>
              <th class="px-4 py-3">Records</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading"><td colspan="6" class="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            <tr v-else-if="items.length === 0"><td colspan="6" class="px-4 py-8 text-center text-gray-500">No attendance registers.</td></tr>
            <tr v-for="row in items" v-else :key="row.id">
              <td class="px-4 py-3 font-medium text-gray-900">{{ row.date }}</td>
              <td class="px-4 py-3 text-gray-600">{{ row.className }}<span v-if="row.sectionName"> / {{ row.sectionName }}</span></td>
              <td class="px-4 py-3 text-gray-600">{{ row.termName || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ row.recordCount }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize" :class="STATUS_BADGES[row.status]">{{ row.status }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <button type="button" class="mr-3 text-indigo-600 hover:underline" @click="openMark(row)">
                  {{ canMark && row.status !== 'approved' ? 'Mark' : 'View' }}
                </button>
                <button
                  v-if="canUpdate && row.status === 'open'"
                  type="button"
                  class="text-red-600 hover:underline"
                  @click="deleteRegister(row)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Report -->
    <div v-else>
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500">Session</label>
          <select v-model="reportForm.sessionId" class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500">Term</label>
          <select v-model="reportForm.termId" class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Whole session</option>
            <option v-for="t in reportTerms" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500">Class</label>
          <select v-model="reportForm.classId" class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="" disabled>Select a class</option>
            <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500">Section</label>
          <select v-model="reportForm.sectionId" class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Whole class</option>
            <option v-for="sec in reportSections" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
          </select>
        </div>
        <button
          type="button"
          :disabled="!reportForm.sessionId || !reportForm.classId || reportLoading"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="loadReport"
        >
          {{ reportLoading ? 'Loading…' : 'Run report' }}
        </button>
      </div>

      <div v-if="reportError" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ reportError }}</div>

      <div v-if="reportLoaded" class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3 text-center">Total</th>
              <th class="px-4 py-3 text-center">Present</th>
              <th class="px-4 py-3 text-center">Late</th>
              <th class="px-4 py-3 text-center">Absent</th>
              <th class="px-4 py-3 text-center">Excused</th>
              <th class="px-4 py-3 text-right">Attendance</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="reportRows.length === 0"><td colspan="7" class="px-4 py-8 text-center text-gray-500">No enrolled students.</td></tr>
            <tr v-for="row in reportRows" v-else :key="row.studentId">
              <td class="px-4 py-3 font-medium text-gray-900">{{ row.admissionNumber }} — {{ row.studentName }}</td>
              <td class="px-4 py-3 text-center text-gray-600">{{ row.total }}</td>
              <td class="px-4 py-3 text-center text-green-700">{{ row.present }}</td>
              <td class="px-4 py-3 text-center text-yellow-700">{{ row.late }}</td>
              <td class="px-4 py-3 text-center text-red-700">{{ row.absent }}</td>
              <td class="px-4 py-3 text-center text-gray-600">{{ row.excused }}</td>
              <td class="px-4 py-3 text-right font-medium" :class="row.attendanceRate === null ? 'text-gray-400' : row.attendanceRate >= 90 ? 'text-green-700' : row.attendanceRate >= 75 ? 'text-yellow-700' : 'text-red-700'">
                {{ row.attendanceRate === null ? '—' : `${row.attendanceRate}%` }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create register modal -->
    <UiBaseModal :open="createOpen" title="New attendance register" @close="createOpen = false">
      <form class="space-y-3" @submit.prevent="submitCreate">
        <div v-if="createError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ createError }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Session</label>
            <select v-model="createForm.sessionId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Term (optional)</label>
            <select v-model="createForm.termId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Whole session</option>
              <option v-for="t in createTerms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Class</label>
            <select v-model="createForm.classId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Select</option>
              <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Section</label>
            <select v-model="createForm.sectionId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Whole class</option>
              <option v-for="sec in createSections" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Date</label>
            <input v-model="createForm.date" type="date" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Notes (optional)</label>
          <textarea v-model="createForm.notes" rows="2" maxlength="5000" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </form>
      <template #footer>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="createOpen = false">Cancel</button>
        <button type="button" :disabled="creating || !createForm.sessionId || !createForm.classId || !createForm.date" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60" @click="submitCreate">
          {{ creating ? 'Creating…' : 'Create' }}
        </button>
      </template>
    </UiBaseModal>

    <!-- Marking modal -->
    <UiBaseModal
      :open="markOpen"
      :title="markSession ? `Attendance — ${markSession.className}${markSession.sectionName ? ` / ${markSession.sectionName}` : ''} · ${markSession.date}` : 'Attendance'"
      wide
      @close="markOpen = false"
    >
      <div v-if="markError" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ markError }}</div>
      <div v-if="markSaving && markRows.length === 0" class="py-8 text-center text-sm text-gray-500">Loading roster…</div>
      <div v-else class="max-h-[50vh] overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-3 py-2">Student</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Remark</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in markRows" :key="row.studentId">
              <td class="px-3 py-2 font-medium text-gray-900">{{ row.studentName }}</td>
              <td class="px-3 py-2">
                <select
                  v-model="row.status"
                  :disabled="!canMark || markSession?.status === 'approved'"
                  class="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </td>
              <td class="px-3 py-2">
                <input
                  v-model="row.remark"
                  :disabled="!canMark || markSession?.status === 'approved'"
                  maxlength="255"
                  placeholder="—"
                  class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <span v-if="markSession" class="mr-auto rounded-full px-2 py-0.5 text-xs font-medium capitalize" :class="STATUS_BADGES[markSession.status]">{{ markSession.status }}</span>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="markOpen = false">Close</button>
        <button
          v-if="canMark && markSession?.status !== 'approved'"
          type="button"
          :disabled="markSaving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="saveMarks"
        >
          {{ markSaving ? 'Saving…' : 'Save marks' }}
        </button>
        <button
          v-if="canUpdate && markSession?.status === 'open'"
          type="button"
          :disabled="markSaving"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          @click="submitRegister"
        >
          Submit for approval
        </button>
        <button
          v-if="canApprove && markSession?.status === 'submitted'"
          type="button"
          :disabled="markSaving"
          class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          @click="approveRegister"
        >
          Approve
        </button>
      </template>
    </UiBaseModal>
  </div>
</template>
