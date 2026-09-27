<script setup lang="ts">
/**
 * Teacher portal dashboard (Phase 16C). Composes the existing
 * teacher self-service endpoints: /teachers/me (profile, classes,
 * today's timetable, pending submissions) and /teachers/me/to-grade.
 */
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type {
  TeacherAssignmentToGradeRow,
  TeacherSelf,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['dashboard.view'] })

const me = ref<TeacherSelf | null>(null)
const toGrade = ref<TeacherAssignmentToGradeRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

function fmtTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

onMounted(async () => {
  try {
    const [meRes, gradeRes] = await Promise.all([
      teachersApi.getMe(),
      teachersApi.listSubmissionsToGrade(),
    ])
    me.value = meRes
    toGrade.value = gradeRes.data
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
        Welcome back{{ me ? `, ${me.profile.firstName}` : '' }}
      </h1>
      <p v-if="me" class="mt-1 text-sm text-text-secondary">
        {{ me.profile.staffNumber }}
        <template v-if="me.profile.specialization">
          · {{ me.profile.specialization }}</template
        >
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

    <template v-else-if="me">
      <!-- Quick stats -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            My classes
          </p>
          <p class="mt-1 text-xl font-semibold text-text-primary">
            {{ me.classes.length }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">Class-subject assignments</p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Today's lessons
          </p>
          <p class="mt-1 text-xl font-semibold text-text-primary">
            {{ me.todayTimetable.length }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">Timetable entries today</p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Submissions to grade
          </p>
          <p class="mt-1 text-xl font-semibold text-text-primary">
            {{ me.pendingSubmissionsCount }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">Awaiting review</p>
        </div>
      </section>

      <!-- To-grade queue -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">
          Submissions to grade
        </h2>
        <p
          v-if="toGrade.length === 0"
          class="mt-3 text-sm text-text-muted"
        >
          Nothing waiting for grading. Well done!
        </p>
        <ul v-else class="mt-4 divide-y divide-border-default">
          <li
            v-for="row in toGrade"
            :key="row.assignmentId"
            class="flex flex-wrap items-baseline justify-between gap-2 py-3"
          >
            <div>
              <p class="text-sm font-medium text-text-primary">
                {{ row.title }}
              </p>
              <p class="text-xs text-text-muted">
                {{ row.subjectName }} · {{ row.className
                }}<template v-if="row.sectionName">
                  · {{ row.sectionName }}</template
                >
              </p>
            </div>
            <span
              class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
            >
              {{ row.pendingCount }} pending
            </span>
          </li>
        </ul>
      </section>

      <!-- My classes -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">My classes</h2>
        <p v-if="me.classes.length === 0" class="mt-3 text-sm text-text-muted">
          No class assignments yet.
        </p>
        <ul v-else class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <li
            v-for="assignment in me.classes"
            :key="assignment.id"
            class="rounded-lg border border-border-default p-4"
          >
            <p class="text-sm font-medium text-text-primary">
              {{ assignment.className }}
              <template v-if="assignment.sectionName">
                · {{ assignment.sectionName }}</template
              >
            </p>
            <p class="mt-0.5 text-xs text-text-muted">
              {{ assignment.subjectName }} · {{ assignment.sessionName }}
              <template v-if="assignment.isPrimaryTeacher">
                · Class teacher</template
              >
            </p>
          </li>
        </ul>
      </section>

      <!-- Today's timetable -->
      <section
        v-if="me.todayTimetable.length > 0"
        class="rounded-xl border border-border-default bg-surface p-6"
      >
        <h2 class="text-base font-semibold text-text-primary">Today</h2>
        <ul class="mt-4 divide-y divide-border-default">
          <li
            v-for="entry in me.todayTimetable"
            :key="entry.id"
            class="flex justify-between gap-3 py-2 text-sm"
          >
            <span class="text-text-primary">
              {{ fmtTime(entry.startTime) }}–{{ fmtTime(entry.endTime) }} ·
              {{ entry.subjectName }}
            </span>
            <span class="text-text-muted">{{ entry.className }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
