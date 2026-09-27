<script setup lang="ts">
/**
 * Teacher portal — attendance recorder (Phase 16C). Mirrors the staff
 * attendance.vue flow on the portal layout: pick class + date → open
 * (or create) the register → mark present/late/absent/excused per
 * student → save → submit for approval. Same scheduleApi endpoints and
 * server-side authorization as the staff page.
 */
import { peopleApi } from '~/services/people'
import { scheduleApi } from '~/services/schedule'
import { teachersApi } from '~/services/teachers'
import { useAuthStore } from '~/stores/auth'
import { formatApiError } from '~/utils/errors'
import type {
  AttendanceSessionListItem,
  AttendanceStatus,
  TeacherClassAssignmentDetail,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['attendance.view'] })

const auth = useAuthStore()
const canMark = computed(() => auth.can('attendance.mark'))

const assignments = ref<TeacherClassAssignmentDetail[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const selectedClassId = ref('')
const registerDate = ref(new Date().toISOString().slice(0, 10))

// One option per class(+section) the teacher is assigned to.
const classOptions = computed(() => {
  const seen = new Set<string>()
  const options: Array<{
    classId: string
    sectionId: string | null
    label: string
    sessionId: string
  }> = []
  for (const a of assignments.value) {
    const key = `${a.classId}:${a.sectionId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    options.push({
      classId: a.classId,
      sectionId: a.sectionId,
      label: `${a.className}${a.sectionName ? ` · ${a.sectionName}` : ''} (${a.sessionName})`,
      sessionId: a.sessionId,
    })
  }
  return options
})

const selectedOption = computed(() =>
  classOptions.value.find((o) => o.classId === selectedClassId.value),
)

// --- Register lifecycle ------------------------------------------------------
interface MarkRow {
  studentId: string
  studentName: string
  status: AttendanceStatus
  remark: string
}

const register = ref<{
  id: string
  date: string
  status: AttendanceSessionListItem['status']
} | null>(null)
const markRows = ref<MarkRow[]>([])
const registerLoading = ref(false)
const actionError = ref<string | null>(null)
const actionBusy = ref(false)

function resetRegister() {
  register.value = null
  markRows.value = []
  actionError.value = null
}

async function openOrCreateRegister() {
  const option = selectedOption.value
  if (!option) return
  actionError.value = null
  registerLoading.value = true
  try {
    const res = await scheduleApi.listSessions({
      page: 1,
      perPage: 100,
      sessionId: option.sessionId,
      classId: option.classId,
    })
    register.value =
      res.data.find((s) => s.date === registerDate.value) ?? null

    if (!register.value) {
      register.value = await scheduleApi.createSession({
        sessionId: option.sessionId,
        classId: option.classId,
        ...(option.sectionId ? { sectionId: option.sectionId } : {}),
        date: registerDate.value,
      })
    }
    await loadRoster()
  } catch (e) {
    actionError.value = formatApiError(e)
  } finally {
    registerLoading.value = false
  }
}

async function loadRoster() {
  const option = selectedOption.value
  if (!option || !register.value) return
  registerLoading.value = true
  try {
    const [detail, enrollRes] = await Promise.all([
      scheduleApi.getSession(register.value.id),
      peopleApi.listEnrollments({
        page: 1,
        perPage: 500,
        sessionId: option.sessionId,
        classId: option.classId,
        status: 'active',
      }),
    ])
    const rows: MarkRow[] = enrollRes.data.map((e) => {
      const existing = detail.records.find(
        (r) => r.studentId === e.studentId,
      )
      return {
        studentId: e.studentId,
        studentName: e.studentName,
        status: existing?.status ?? 'present',
        remark: existing?.remark ?? '',
      }
    })
    // Keep records for students no longer actively enrolled.
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
    actionError.value = formatApiError(e)
  } finally {
    registerLoading.value = false
  }
}

async function saveMarks() {
  if (!register.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    const updated = await scheduleApi.markAttendance(register.value.id, {
      records: markRows.value.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        ...(r.remark ? { remark: r.remark } : {}),
      })),
    })
    register.value = { ...register.value, status: updated.status }
  } catch (e) {
    actionError.value = formatApiError(e)
  } finally {
    actionBusy.value = false
  }
}

async function submitRegister() {
  if (!register.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    const updated = await scheduleApi.submitSession(register.value.id)
    register.value = { ...register.value, status: updated.status }
  } catch (e) {
    actionError.value = formatApiError(e)
  } finally {
    actionBusy.value = false
  }
}

watch([selectedClassId, registerDate], resetRegister)

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

onMounted(async () => {
  try {
    const res = await teachersApi.listMyClasses({ page: 1, perPage: 200 })
    assignments.value = res.data
    selectedClassId.value = classOptions.value[0]?.classId ?? ''
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
        Attendance
      </h1>
      <p class="mt-1 text-sm text-text-secondary">
        Open a register, mark your class and submit it for approval.
      </p>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading classes…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <p
      v-else-if="classOptions.length === 0"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      You have no class assignments yet.
    </p>

    <template v-else>
      <!-- Register picker -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <div class="flex flex-wrap items-end gap-4">
          <label class="block text-sm">
            <span class="text-text-secondary">Class</span>
            <select
              v-model="selectedClassId"
              class="mt-1 block w-64 rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
            >
              <option
                v-for="option in classOptions"
                :key="`${option.classId}:${option.sectionId ?? ''}`"
                :value="option.classId"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-text-secondary">Date</span>
            <input
              v-model="registerDate"
              type="date"
              class="mt-1 block rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
            >
          </label>
          <button
            type="button"
            :disabled="registerLoading"
            class="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
            @click="openOrCreateRegister"
          >
            {{ registerLoading ? 'Opening…' : 'Open register' }}
          </button>
        </div>
        <p
          v-if="actionError"
          class="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700"
          role="alert"
        >
          {{ actionError }}
        </p>
      </section>

      <!-- Register rows -->
      <section
        v-if="register"
        class="rounded-xl border border-border-default bg-surface p-6"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-text-primary">
              Register — {{ register.date }}
            </h2>
            <p class="mt-0.5 text-xs text-text-muted">
              Status: <span class="capitalize">{{ register.status }}</span> ·
              {{ markRows.length }} students
            </p>
          </div>
          <div v-if="canMark && register.status === 'open'" class="flex gap-2">
            <button
              type="button"
              :disabled="actionBusy || markRows.length === 0"
              class="rounded-md border border-border-strong px-4 py-2 text-sm text-brand-primary hover:bg-surface-muted disabled:opacity-50"
              @click="saveMarks"
            >
              {{ actionBusy ? 'Saving…' : 'Save' }}
            </button>
            <button
              type="button"
              :disabled="actionBusy || markRows.length === 0"
              class="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
              @click="submitRegister"
            >
              {{ actionBusy ? 'Working…' : 'Save & submit' }}
            </button>
          </div>
        </div>

        <p
          v-if="registerLoading"
          class="mt-4 text-sm text-text-muted"
          role="status"
        >
          Loading roster…
        </p>
        <p
          v-else-if="register.status !== 'open'"
          class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800"
        >
          This register is {{ register.status }} — records are read-only here.
        </p>
        <ul v-else class="mt-4 divide-y divide-border-default">
          <li
            v-for="row in markRows"
            :key="row.studentId"
            class="flex flex-wrap items-center justify-between gap-3 py-2"
          >
            <span class="text-sm text-text-primary">{{ row.studentName }}</span>
            <div class="flex items-center gap-1">
              <button
                v-for="status in STATUS_OPTIONS"
                :key="status"
                type="button"
                class="rounded-md px-2.5 py-1 text-xs capitalize"
                :class="
                  row.status === status
                    ? 'bg-brand-primary text-text-inverse'
                    : 'border border-border-default text-text-secondary hover:bg-surface-muted'
                "
                @click="row.status = status"
              >
                {{ status }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <p
        v-else-if="!registerLoading"
        class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      >
        Pick a class and date, then open the register.
      </p>
    </template>
  </div>
</template>
