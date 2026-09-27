<script setup lang="ts">
/**
 * Parent portal — per-child attendance (Phase 16B). Reuses
 * GET /parents/me/children/[studentId]/attendance (ownership enforced
 * server-side); session/term come from the overview payload.
 */
import { parentsApi } from '~/services/parents'
import { formatApiError } from '~/utils/errors'
import type {
  ParentOverview,
  StudentAttendanceDay,
  StudentAttendanceSummary,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['attendance.view'] })

const overview = ref<ParentOverview | null>(null)
const selectedId = ref<string | null>(null)
const summary = ref<StudentAttendanceSummary | null>(null)
const days = ref<StudentAttendanceDay[]>([])
const loading = ref(true)
const listLoading = ref(false)
const error = ref<string | null>(null)

const children = computed(() => overview.value?.children ?? [])

async function loadAttendance() {
  const child = children.value.find((c) => c.studentId === selectedId.value)
  const session = overview.value?.session
  if (!child || !session) {
    summary.value = null
    days.value = []
    return
  }
  listLoading.value = true
  try {
    const term = overview.value?.term
    const res = await parentsApi.getChildAttendance(child.studentId, {
      sessionId: session.id,
      ...(term ? { termId: term.id } : {}),
    })
    summary.value = res.summary
    days.value = res.data
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    listLoading.value = false
  }
}

watch(selectedId, loadAttendance)

function fmtDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
}

const STATUS_STYLES: Record<string, string> = {
  present: 'text-green-700',
  late: 'text-amber-600',
  absent: 'text-brand-emphasis',
  excused: 'text-text-muted',
}

onMounted(async () => {
  try {
    overview.value = await parentsApi.getOverview()
    selectedId.value = overview.value.children[0]?.studentId ?? null
    if (selectedId.value) await loadAttendance()
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-semibold text-text-primary">
          Attendance
        </h1>
        <p v-if="overview?.session" class="mt-1 text-sm text-text-secondary">
          {{ overview.session.name
          }}<template v-if="overview.term"> · {{ overview.term.name }}</template>
        </p>
      </div>
      <label v-if="children.length > 1" class="text-sm">
        <span class="mr-2 text-text-muted">Child</span>
        <select
          v-model="selectedId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option v-for="child in children" :key="child.studentId" :value="child.studentId">
            {{ child.name }}
          </option>
        </select>
      </label>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading attendance…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <template v-else-if="summary">
      <section class="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div class="rounded-xl border border-border-default bg-surface p-5 text-center">
          <p class="text-xl font-semibold text-text-primary">
            {{ summary.attendanceRate ?? '—'
            }}<span v-if="summary.attendanceRate != null">%</span>
          </p>
          <p class="mt-1 text-xs text-text-muted">Attendance rate</p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5 text-center">
          <p class="text-xl font-semibold text-green-700">{{ summary.present }}</p>
          <p class="mt-1 text-xs text-text-muted">Present</p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5 text-center">
          <p class="text-xl font-semibold text-amber-600">{{ summary.late }}</p>
          <p class="mt-1 text-xs text-text-muted">Late</p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5 text-center">
          <p class="text-xl font-semibold text-brand-emphasis">{{ summary.absent }}</p>
          <p class="mt-1 text-xs text-text-muted">Absent</p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5 text-center">
          <p class="text-xl font-semibold text-text-primary">{{ summary.excused }}</p>
          <p class="mt-1 text-xs text-text-muted">Excused</p>
        </div>
      </section>

      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">By day</h2>
        <p v-if="listLoading" class="mt-3 text-sm text-text-muted" role="status">
          Loading records…
        </p>
        <p
          v-else-if="days.length === 0"
          class="mt-3 text-sm text-text-muted"
        >
          No attendance records for this period yet.
        </p>
        <ul v-else class="mt-4 divide-y divide-border-default">
          <li
            v-for="day in days"
            :key="day.date"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span class="text-text-primary">{{ fmtDate(day.date) }}</span>
            <span
              class="font-medium capitalize"
              :class="STATUS_STYLES[day.status] ?? 'text-text-secondary'"
            >
              {{ day.status }}
            </span>
          </li>
        </ul>
      </section>
    </template>

    <p
      v-else
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      No attendance data available.
    </p>
  </div>
</template>
