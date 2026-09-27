<script setup lang="ts">
/**
 * Parent portal dashboard (Phase 16B). One round-trip to
 * GET /parents/me/overview; children are resolved server-side from the
 * parent's linked profiles. Progress slices respect the publication
 * lock (unpublished terms show nothing).
 */
import { parentsApi } from '~/services/parents'
import { formatApiError } from '~/utils/errors'
import { formatMoney } from '~/shared/utils/money'
import type { ParentOverview } from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['dashboard.view'] })

const overview = ref<ParentOverview | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedId = ref<string | null>(null)

const selected = computed(
  () =>
    overview.value?.children.find((c) => c.studentId === selectedId.value) ??
    overview.value?.children[0] ??
    null,
)

onMounted(async () => {
  try {
    overview.value = await parentsApi.getOverview()
    selectedId.value = overview.value.children[0]?.studentId ?? null
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
          Family dashboard
        </h1>
        <p v-if="overview" class="mt-1 text-sm text-text-secondary">
          <template v-if="overview.session">
            {{ overview.session.name
            }}<template v-if="overview.term">
              · {{ overview.term.name }}</template
            >
          </template>
        </p>
      </div>
      <label v-if="overview && overview.children.length > 1" class="text-sm">
        <span class="mr-2 text-text-muted">Child</span>
        <select
          v-model="selectedId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option
            v-for="child in overview.children"
            :key="child.studentId"
            :value="child.studentId"
          >
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
      Loading overview…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <p
      v-else-if="!overview || overview.children.length === 0"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      No children are linked to your account yet. Please contact the school
      office.
    </p>

    <template v-else-if="selected">
      <!-- Summary cards -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Current class
          </p>
          <p class="mt-1 text-lg font-semibold text-text-primary">
            {{ selected.className ?? 'Not enrolled' }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            {{ selected.admissionNumber }}
          </p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Term average
          </p>
          <p class="mt-1 text-lg font-semibold text-text-primary">
            {{ selected.progress?.averageScore ?? '—' }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            Cumulative
            {{ selected.cumulativeAverage ?? '—' }}
          </p>
        </div>
        <div class="rounded-xl border border-border-default bg-surface p-5">
          <p class="text-xs uppercase tracking-wide text-text-muted">
            Outstanding fees
          </p>
          <p class="mt-1 text-lg font-semibold text-text-primary">
            {{ formatMoney(selected.fees.outstandingBalance) }}
          </p>
          <p class="mt-1 text-sm text-text-secondary">
            {{ selected.fees.outstandingInvoiceCount }} invoice(s) ·
            {{ selected.fees.overdueInvoiceCount }} overdue
          </p>
          <NuxtLink
            to="/portal/parent/fees"
            class="mt-2 inline-block text-sm text-brand-primary hover:underline"
          >
            Pay fees →
          </NuxtLink>
        </div>
      </section>

      <!-- Per-subject progress -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">
          Subject progress (current term)
        </h2>
        <p
          v-if="!selected.progress || selected.progress.subjects.length === 0"
          class="mt-3 text-sm text-text-muted"
        >
          No published results for the current term yet.
        </p>
        <div v-else class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border-default text-left text-text-muted">
                <th class="py-2 pr-4 font-medium">Subject</th>
                <th class="py-2 pr-4 font-medium">Average</th>
                <th class="py-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="subject in selected.progress.subjects"
                :key="subject.subjectId"
                class="border-b border-border-default last:border-0"
              >
                <td class="py-2 pr-4 text-text-primary">
                  {{ subject.subjectName }}
                </td>
                <td class="py-2 pr-4 text-text-primary">
                  {{ subject.percentage }}
                </td>
                <td class="py-2 text-text-secondary">
                  {{ subject.grade ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Attendance snapshot -->
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-text-primary">Attendance</h2>
          <NuxtLink
            to="/portal/parent/attendance"
            class="text-sm text-brand-primary hover:underline"
          >
            Details →
          </NuxtLink>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div class="rounded-lg border border-border-default p-3 text-center">
            <p class="text-lg font-semibold text-text-primary">
              {{ selected.attendance.attendanceRate ?? '—'
              }}<span
                v-if="selected.attendance.attendanceRate != null"
                >%</span
              >
            </p>
            <p class="text-xs text-text-muted">Rate</p>
          </div>
          <div class="rounded-lg border border-border-default p-3 text-center">
            <p class="text-lg font-semibold text-green-700">
              {{ selected.attendance.present }}
            </p>
            <p class="text-xs text-text-muted">Present</p>
          </div>
          <div class="rounded-lg border border-border-default p-3 text-center">
            <p class="text-lg font-semibold text-amber-600">
              {{ selected.attendance.late }}
            </p>
            <p class="text-xs text-text-muted">Late</p>
          </div>
          <div class="rounded-lg border border-border-default p-3 text-center">
            <p class="text-lg font-semibold text-brand-emphasis">
              {{ selected.attendance.absent }}
            </p>
            <p class="text-xs text-text-muted">Absent</p>
          </div>
          <div class="rounded-lg border border-border-default p-3 text-center">
            <p class="text-lg font-semibold text-text-primary">
              {{ selected.attendance.excused }}
            </p>
            <p class="text-xs text-text-muted">Excused</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
