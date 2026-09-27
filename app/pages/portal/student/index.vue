<script setup lang="ts">
/**
 * Student portal dashboard (Phase 16A). One round-trip to
 * GET /students/me/dashboard; every value is scoped server-side to the
 * calling student.
 */
import { studentsApi } from '~/services/students'
import { formatApiError } from '~/utils/errors'
import type { StudentDashboard, Weekday } from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['dashboard.view'] })

const dashboard = ref<StudentDashboard | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const WEEKDAY_ORDER: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

function fmtTime(value: string): string {
  // Times are HH:MM:SS — display HH:MM.
  return value.length >= 5 ? value.slice(0, 5) : value
}

const weekTimetable = computed(() => {
  const byDay = new Map<Weekday, StudentDashboard['weekTimetable']>()
  for (const entry of dashboard.value?.weekTimetable ?? []) {
    const list = byDay.get(entry.weekday) ?? []
    list.push(entry)
    byDay.set(entry.weekday, list)
  }
  return WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    entries: (byDay.get(weekday) ?? []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  })).filter((day) => day.entries.length > 0)
})

onMounted(async () => {
  try {
    dashboard.value = await studentsApi.getDashboard()
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
        Welcome back{{ dashboard ? `, ${dashboard.profile.firstName}` : '' }}
      </h1>
      <p v-if="dashboard" class="mt-1 text-sm text-text-secondary">
        {{ dashboard.profile.admissionNumber }}
        <span v-if="dashboard.activeEnrollment">
          · {{ dashboard.activeEnrollment.className
          }}<template v-if="dashboard.activeEnrollment.sectionName">
            ({{ dashboard.activeEnrollment.sectionName }})</template
          >
          · {{ dashboard.activeEnrollment.sessionName }}
        </span>
      </p>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading dashboard…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <template v-else-if="dashboard">
      <!-- Summary cards -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Current class
          </p>
          <p class="mt-1 text-xl font-semibold text-text-primary">
            {{ dashboard.activeEnrollment?.className ?? 'Not enrolled' }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            {{
              dashboard.activeEnrollment?.termName ??
              dashboard.activeEnrollment?.sessionName ??
              '—'
            }}
          </p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Attendance (term)
          </p>
          <p class="mt-1 text-xl font-semibold text-text-primary">
            {{ dashboard.attendanceSummary.attendanceRate ?? '—'
            }}<span v-if="dashboard.attendanceSummary.attendanceRate != null"
              >%</span
            >
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            {{ dashboard.attendanceSummary.present }} present ·
            {{ dashboard.attendanceSummary.late }} late ·
            {{ dashboard.attendanceSummary.absent }} absent
          </p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Pending assignments
          </p>
          <p class="mt-1 text-xl font-semibold text-text-primary">
            {{ dashboard.pendingAssignments.length }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            Latest due
            {{
              fmtDate(dashboard.pendingAssignments[0]?.dueDate ?? null)
            }}
          </p>
        </div>
      </section>

      <!-- Upcoming deadlines -->
      <section
        v-if="dashboard.pendingAssignments.length"
        class="rounded-xl border border-border-default bg-surface p-6"
      >
        <h2 class="text-base font-semibold text-text-primary">
          Upcoming deadlines
        </h2>
        <ul class="mt-4 space-y-3">
          <li
            v-for="assignment in dashboard.pendingAssignments"
            :key="assignment.id"
            class="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-default pb-3 last:border-0 last:pb-0"
          >
            <div>
              <p class="text-sm font-medium text-text-primary">
                {{ assignment.title }}
              </p>
              <p class="text-xs text-text-muted">
                {{ assignment.subjectName }} · {{ assignment.className }}
              </p>
            </div>
            <p class="text-sm text-text-secondary">
              Due {{ fmtDate(assignment.dueDate) }}
            </p>
          </li>
        </ul>
      </section>

      <!-- Recent published scores -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">
          Recent results
        </h2>
        <p
          v-if="dashboard.recentScores.length === 0"
          class="mt-3 text-sm text-text-muted"
        >
          No published results yet.
        </p>
        <div v-else class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border-default text-left text-text-muted">
                <th class="py-2 pr-4 font-medium">Subject</th>
                <th class="py-2 pr-4 font-medium">Exam</th>
                <th class="py-2 pr-4 font-medium">Score</th>
                <th class="py-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="score in dashboard.recentScores"
                :key="`${score.examId}-${score.subjectId}`"
                class="border-b border-border-default last:border-0"
              >
                <td class="py-2 pr-4 text-text-primary">
                  {{ score.subjectName }}
                </td>
                <td class="py-2 pr-4 text-text-secondary">
                  {{ score.examName }}
                </td>
                <td class="py-2 pr-4 text-text-primary">
                  {{ score.score }} / {{ score.maxScore }}
                </td>
                <td class="py-2 text-text-secondary">
                  {{ score.grade ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Timetable -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">Timetable</h2>
        <p
          v-if="weekTimetable.length === 0"
          class="mt-3 text-sm text-text-muted"
        >
          No timetable entries for your class yet.
        </p>
        <div v-else class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div
            v-for="day in weekTimetable"
            :key="day.weekday"
            class="rounded-lg border border-border-default p-4"
          >
            <p
              class="text-xs font-semibold uppercase tracking-wide text-text-muted"
            >
              {{ day.weekday }}
            </p>
            <ul class="mt-2 space-y-1.5 text-sm">
              <li
                v-for="entry in day.entries"
                :key="entry.id"
                class="flex justify-between gap-3"
              >
                <span class="text-text-primary">
                  {{ fmtTime(entry.startTime) }}–{{ fmtTime(entry.endTime) }}
                  · {{ entry.subjectName }}
                </span>
                <span class="text-text-muted">
                  {{ entry.room ?? '—' }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Announcements -->
      <section
        v-if="dashboard.recentAnnouncements.length"
        class="rounded-xl border border-border-default bg-surface p-6"
      >
        <h2 class="text-base font-semibold text-text-primary">
          Announcements
        </h2>
        <ul class="mt-4 space-y-3">
          <li
            v-for="announcement in dashboard.recentAnnouncements"
            :key="announcement.id"
            class="border-b border-border-default pb-3 last:border-0 last:pb-0"
          >
            <p class="text-sm font-medium text-text-primary">
              {{ announcement.title }}
            </p>
            <p class="mt-0.5 text-xs text-text-muted">
              {{ fmtDate(announcement.createdAt) }}
              <template v-if="announcement.authorName">
                · {{ announcement.authorName }}</template
              >
            </p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
