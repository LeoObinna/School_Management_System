<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { reportsApi, downloadCsv } from '~/services/reports'
import { formatApiError } from '~/utils/errors'
import type {
  AttendanceReportClassRow,
  EnrollmentReportRow,
  OverviewReport,
} from '~/shared/types'

definePageMeta({ permissions: ['reports.view'] })

const auth = useAuthStore()
const canExport = computed(() => auth.can('reports.export'))

const loading = ref(false)
const loadError = ref<string | null>(null)
const overview = ref<OverviewReport | null>(null)

const attendance = ref<AttendanceReportClassRow[]>([])
const enrollments = ref<EnrollmentReportRow[]>([])

async function loadOverview() {
  loading.value = true
  loadError.value = null
  try {
    const [ov, att, enr] = await Promise.all([
      reportsApi.overview(),
      reportsApi.attendance(),
      reportsApi.enrollments(),
    ])
    overview.value = ov
    attendance.value = att.data
    enrollments.value = enr.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function exportAttendance() {
  try {
    await downloadCsv('/reports/attendance', 'attendance-report.csv')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

async function exportEnrollments() {
  try {
    await downloadCsv('/reports/enrollments', 'enrollment-report.csv')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

async function exportStudents() {
  try {
    await downloadCsv('/students', 'students.csv')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

onMounted(() => {
  void loadOverview()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">Reports</h1>
      <p class="mt-1 text-sm text-gray-500">
        School-wide operational reports and CSV exports.
      </p>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- Overview cards -->
    <section v-if="overview" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Students</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.studentsTotal }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ overview.studentsActive }} active · {{ overview.studentsArchived }} archived</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Teachers</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.teachers }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Parents</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.parents }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Staff</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.staff }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Classes</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.classes }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Sections</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.sections }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Subjects</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.subjects }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase text-gray-500">Events</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ overview.eventsUpcoming + overview.eventsPast }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ overview.eventsUpcoming }} upcoming</p>
      </div>
    </section>

    <section v-if="overview" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-medium text-gray-900">Enrollments by status</h3>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div v-for="n in ['active','completed','promoted','repeated','withdrawn']" :key="n">
            <dt class="text-xs uppercase text-gray-500">{{ n }}</dt>
            <dd class="font-medium text-gray-900">{{ overview.enrollmentsByStatus[n as keyof typeof overview.enrollmentsByStatus] }}</dd>
          </div>
        </dl>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-medium text-gray-900">Announcements by status</h3>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div v-for="n in ['draft','scheduled','published','archived']" :key="n">
            <dt class="text-xs uppercase text-gray-500">{{ n }}</dt>
            <dd class="font-medium text-gray-900">{{ overview.announcementsByStatus[n as keyof typeof overview.announcementsByStatus] }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- CSV exports -->
    <section class="rounded-lg border border-gray-200 bg-white p-4">
      <h3 class="text-sm font-medium text-gray-900">CSV exports</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-if="canExport"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportAttendance"
        >
          Attendance (per class)
        </button>
        <button
          v-if="canExport"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportEnrollments"
        >
          Enrollments (per class × status)
        </button>
        <button
          v-if="canExport"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportStudents"
        >
          Student directory
        </button>
        <NuxtLink
          v-if="auth.can('audit_logs.view')"
          to="/audit-logs"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Open audit logs →
        </NuxtLink>
      </div>
      <p v-if="!canExport" class="mt-2 text-xs text-gray-500">
        CSV export requires the <code class="font-mono">reports.export</code> permission.
      </p>
    </section>

    <!-- Attendance per class -->
    <section class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 class="text-sm font-medium text-gray-900">Attendance by class</h3>
      </div>
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Class</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Present</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Absent</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Late</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Excused</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Total</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Rate (%)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="attendance.length === 0">
            <td colspan="7" class="px-4 py-4 text-center text-gray-400">No attendance records in scope.</td>
          </tr>
          <tr v-for="r in attendance" v-else :key="r.classId">
            <td class="px-4 py-2 text-gray-900">{{ r.className }}</td>
            <td class="px-4 py-2 text-right text-green-700">{{ r.present }}</td>
            <td class="px-4 py-2 text-right text-red-700">{{ r.absent }}</td>
            <td class="px-4 py-2 text-right text-yellow-700">{{ r.late }}</td>
            <td class="px-4 py-2 text-right text-gray-500">{{ r.excused }}</td>
            <td class="px-4 py-2 text-right text-gray-900">{{ r.total }}</td>
            <td class="px-4 py-2 text-right font-medium text-gray-900">{{ r.rate }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Enrollments per class x status -->
    <section class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-200 px-4 py-3">
        <h3 class="text-sm font-medium text-gray-900">Enrollments by class × status</h3>
      </div>
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Class</th>
            <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Count</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="enrollments.length === 0">
            <td colspan="3" class="px-4 py-4 text-center text-gray-400">No enrollments in scope.</td>
          </tr>
          <tr v-for="r in enrollments" v-else :key="`${r.classId}-${r.status}`">
            <td class="px-4 py-2 text-gray-900">{{ r.className }}</td>
            <td class="px-4 py-2 font-mono text-xs text-gray-700">{{ r.status }}</td>
            <td class="px-4 py-2 text-right text-gray-900">{{ r.count }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
