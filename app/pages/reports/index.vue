<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { reportsApi, financeReportsApi, downloadCsv, downloadAuditCertificate } from '~/services/reports'
import { academicsApi } from '~/services/academics'
import { formatApiError } from '~/utils/errors'
import { formatMoney } from '~/shared/utils/money'
import type {
  AcademicSession,
  AdmissionsPipelineReport,
  AttendanceReportClassRow,
  EnrollmentReportRow,
  FinanceByClassReport,
  FinanceByTermReport,
  FinanceFeePurposeReport,
  OverviewReport,
  SchoolClass,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['reports.view'] })

const auth = useAuthStore()
const canExport = computed(() => auth.can('reports.export'))
const canViewAuditLogs = computed(() => auth.can('audit_logs.view'))
const canDownloadAuditCertificate = computed(
  () => canExport.value && canViewAuditLogs.value,
)
// School-wide finance aggregates are staff-only (parents hold
// invoices.view for their own children but are rejected server-side).
const canViewFinanceReports = computed(
  () =>
    auth.can('finance.export') ||
    auth.can('invoices.create') ||
    auth.can('fees.manage_structure') ||
    auth.can('payments.record'),
)
const canExportFinance = computed(() => auth.can('finance.export'))

const loading = ref(false)
const loadError = ref<string | null>(null)
const overview = ref<OverviewReport | null>(null)

const attendance = ref<AttendanceReportClassRow[]>([])
const enrollments = ref<EnrollmentReportRow[]>([])
const admissions = ref<AdmissionsPipelineReport | null>(null)

// --- Expanded financial reports (Phase 14D) --------------------------------
const financeLoading = ref(false)
const financeError = ref<string | null>(null)
const feePurposeReport = ref<FinanceFeePurposeReport | null>(null)
const byClassReport = ref<FinanceByClassReport | null>(null)
const byTermReport = ref<FinanceByTermReport | null>(null)
const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const classes = ref<SchoolClass[]>([])
const financeFilters = reactive({
  sessionId: '',
  termId: '',
  classId: '',
})

async function loadFinanceLookups() {
  const [sessionPage, classPage] = await Promise.all([
    academicsApi.listSessions({ perPage: 100 }),
    academicsApi.listClasses({ perPage: 100 }),
  ])
  sessions.value = sessionPage.data
  classes.value = classPage.data
}

async function loadTermsForSession(sessionId: string) {
  if (!sessionId) {
    terms.value = []
    return
  }
  const page = await academicsApi.listTerms({ sessionId, perPage: 50 })
  terms.value = page.data
}

async function loadFinanceReports() {
  if (!canViewFinanceReports.value) return
  financeLoading.value = true
  financeError.value = null
  try {
    const f = financeFilters
    const [purpose, byClass, byTerm] = await Promise.all([
      financeReportsApi.feePurposes({
        sessionId: f.sessionId || undefined,
        termId: f.termId || undefined,
        classId: f.classId || undefined,
      }),
      financeReportsApi.byClass({
        sessionId: f.sessionId || undefined,
        termId: f.termId || undefined,
      }),
      financeReportsApi.byTerm({
        sessionId: f.sessionId || undefined,
        classId: f.classId || undefined,
      }),
    ])
    feePurposeReport.value = purpose.data
    byClassReport.value = byClass.data
    byTermReport.value = byTerm.data
  } catch (e) {
    financeError.value = formatApiError(e)
  } finally {
    financeLoading.value = false
  }
}

function financeParams() {
  return {
    sessionId: financeFilters.sessionId || undefined,
    termId: financeFilters.termId || undefined,
    classId: financeFilters.classId || undefined,
  }
}

async function exportFinance(path: string, fileBase: string, format: 'csv' | 'xlsx') {
  try {
    await downloadCsv(path, `${fileBase}.${format}`, financeParams(), format)
  } catch (e) {
    financeError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

watch(
  () => financeFilters.sessionId,
  async (sessionId) => {
    financeFilters.termId = ''
    await loadTermsForSession(sessionId)
    await loadFinanceReports()
  },
)
watch(
  () => [financeFilters.termId, financeFilters.classId],
  () => {
    void loadFinanceReports()
  },
)

async function loadOverview() {
  loading.value = true
  loadError.value = null
  try {
    const [ov, att, enr, adm] = await Promise.all([
      reportsApi.overview(),
      reportsApi.attendance(),
      reportsApi.enrollments(),
      auth.can('admissions.view')
        ? reportsApi.admissions()
        : Promise.resolve(null),
    ])
    overview.value = ov
    attendance.value = att.data
    enrollments.value = enr.data
    admissions.value = adm
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

async function exportAdmissionsPipeline() {
  try {
    await downloadCsv('/reports/admissions', 'admissions-pipeline.csv')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

async function downloadAuditCert() {
  try {
    const stamp = new Date().toISOString().slice(0, 10)
    await downloadAuditCertificate(`audit-certificate-${stamp}.pdf`)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Export failed.'
  }
}

function stageLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

onMounted(() => {
  void loadOverview()
  if (canViewFinanceReports.value) {
    void loadFinanceLookups()
    void loadFinanceReports()
  }
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

    <!-- Expanded financial reports (Phase 14D) -->
    <section v-if="canViewFinanceReports" class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Financial reports</h2>
          <p class="mt-1 text-sm text-gray-500">
            Billed, collected and outstanding by fee purpose, class and term
            (issued / partially paid / paid invoices).
          </p>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="block">
            <span class="text-xs font-medium uppercase text-gray-500">Session</span>
            <select
              v-model="financeFilters.sessionId"
              class="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All sessions</option>
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs font-medium uppercase text-gray-500">Term</span>
            <select
              v-model="financeFilters.termId"
              :disabled="!financeFilters.sessionId"
              class="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-50"
            >
              <option value="">All terms</option>
              <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs font-medium uppercase text-gray-500">Class</span>
            <select
              v-model="financeFilters.classId"
              class="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All classes</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          Term applies to fee-purpose and class breakdowns; class applies to fee-purpose and term breakdowns.
        </p>
      </div>

      <p v-if="financeError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {{ financeError }}
      </p>
      <p v-if="financeLoading" class="text-sm text-gray-500">Loading financial reports…</p>

      <!-- By fee purpose -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div>
            <h3 class="text-sm font-medium text-gray-900">By fee purpose</h3>
            <p class="mt-1 text-xs text-gray-500">
              Collected/outstanding are allocated from invoice payments in proportion to each line's share.
            </p>
          </div>
          <div v-if="canExportFinance" class="flex gap-2">
            <button
              class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="exportFinance('/reports/finance/fee-purposes', 'finance-by-fee-purpose', 'csv')"
            >
              CSV
            </button>
            <button
              class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="exportFinance('/reports/finance/fee-purposes', 'finance-by-fee-purpose', 'xlsx')"
            >
              XLSX
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Fee purpose</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Lines</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Invoices</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Billed</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Collected</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Outstanding</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="feePurposeReport && feePurposeReport.data.length === 0">
                <td colspan="6" class="px-4 py-4 text-center text-gray-400">No invoices in scope.</td>
              </tr>
              <template v-else-if="feePurposeReport">
                <tr v-for="r in feePurposeReport.data" :key="r.purpose">
                  <td class="px-4 py-2 text-gray-900">{{ r.purpose }}</td>
                  <td class="px-4 py-2 text-right text-gray-500">{{ r.lineCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-500">{{ r.invoiceCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ formatMoney(r.billed) }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ formatMoney(r.collected) }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ formatMoney(r.outstanding) }}</td>
                </tr>
                <tr class="bg-gray-50 font-medium">
                  <td class="px-4 py-2 text-gray-900">Total</td>
                  <td class="px-4 py-2"></td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ feePurposeReport.totals.invoiceCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ formatMoney(feePurposeReport.totals.billed) }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ formatMoney(feePurposeReport.totals.collected) }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ formatMoney(feePurposeReport.totals.outstanding) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- By class -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h3 class="text-sm font-medium text-gray-900">By class (active enrollment)</h3>
          <div v-if="canExportFinance" class="flex gap-2">
            <button
              class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="exportFinance('/reports/finance/by-class', 'finance-by-class', 'csv')"
            >
              CSV
            </button>
            <button
              class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="exportFinance('/reports/finance/by-class', 'finance-by-class', 'xlsx')"
            >
              XLSX
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Class</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Invoices</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Students</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Billed</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Collected</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Outstanding</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="byClassReport && byClassReport.data.length === 0">
                <td colspan="6" class="px-4 py-4 text-center text-gray-400">No invoices in scope.</td>
              </tr>
              <template v-else-if="byClassReport">
                <tr v-for="r in byClassReport.data" :key="r.classId ?? 'unassigned'">
                  <td class="px-4 py-2 text-gray-900">{{ r.className }}</td>
                  <td class="px-4 py-2 text-right text-gray-500">{{ r.invoiceCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-500">{{ r.studentCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ formatMoney(r.billed) }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ formatMoney(r.collected) }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ formatMoney(r.outstanding) }}</td>
                </tr>
                <tr class="bg-gray-50 font-medium">
                  <td class="px-4 py-2 text-gray-900">Total</td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ byClassReport.totals.invoiceCount }}</td>
                  <td class="px-4 py-2"></td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ formatMoney(byClassReport.totals.billed) }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ formatMoney(byClassReport.totals.collected) }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ formatMoney(byClassReport.totals.outstanding) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- By term -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h3 class="text-sm font-medium text-gray-900">By term</h3>
          <div v-if="canExportFinance" class="flex gap-2">
            <button
              class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="exportFinance('/reports/finance/by-term', 'finance-by-term', 'csv')"
            >
              CSV
            </button>
            <button
              class="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              @click="exportFinance('/reports/finance/by-term', 'finance-by-term', 'xlsx')"
            >
              XLSX
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Term</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Invoices</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Students</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Billed</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Collected</th>
                <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Outstanding</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="byTermReport && byTermReport.data.length === 0">
                <td colspan="6" class="px-4 py-4 text-center text-gray-400">No invoices in scope.</td>
              </tr>
              <template v-else-if="byTermReport">
                <tr v-for="r in byTermReport.data" :key="r.termId ?? 'unassigned'">
                  <td class="px-4 py-2 text-gray-900">{{ r.termName }}</td>
                  <td class="px-4 py-2 text-right text-gray-500">{{ r.invoiceCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-500">{{ r.studentCount }}</td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ formatMoney(r.billed) }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ formatMoney(r.collected) }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ formatMoney(r.outstanding) }}</td>
                </tr>
                <tr class="bg-gray-50 font-medium">
                  <td class="px-4 py-2 text-gray-900">Total</td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ byTermReport.totals.invoiceCount }}</td>
                  <td class="px-4 py-2"></td>
                  <td class="px-4 py-2 text-right text-gray-900">{{ formatMoney(byTermReport.totals.billed) }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ formatMoney(byTermReport.totals.collected) }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ formatMoney(byTermReport.totals.outstanding) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- CSV exports -->
    <section class="rounded-lg border border-gray-200 bg-white p-4">
      <h3 class="text-sm font-medium text-gray-900">Exports</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-if="canExport"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportAttendance"
        >
          Attendance CSV
        </button>
        <button
          v-if="canExport"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportEnrollments"
        >
          Enrollments CSV
        </button>
        <button
          v-if="canExport"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportStudents"
        >
          Student directory CSV
        </button>
        <button
          v-if="canExport && admissions"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="exportAdmissionsPipeline"
        >
          Admissions pipeline CSV
        </button>
        <button
          v-if="canDownloadAuditCertificate"
          class="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100"
          @click="downloadAuditCert"
        >
          Audit certificate (PDF)
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

    <!-- Admissions pipeline -->
    <section
      v-if="admissions"
      class="overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      <div class="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-gray-900">Admissions pipeline</h3>
          <p class="mt-1 text-xs text-gray-500">
            {{ admissions.total }} application{{ admissions.total === 1 ? '' : 's' }} across all stages
          </p>
        </div>
      </div>
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stage</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Count</th>
            <th class="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Share (%)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="admissions.data.length === 0">
            <td colspan="3" class="px-4 py-4 text-center text-gray-400">No admissions data in scope.</td>
          </tr>
          <template v-else>
            <tr v-for="row in admissions.data" :key="row.status">
              <td class="px-4 py-2 text-gray-900">{{ stageLabel(row.status) }}</td>
              <td class="px-4 py-2 text-right text-gray-900">{{ row.count }}</td>
              <td class="px-4 py-2 text-right text-gray-500">
                {{ admissions.total > 0 ? ((row.count / admissions.total) * 100).toFixed(1) : '0.0' }}
              </td>
            </tr>
            <tr class="bg-gray-50 font-medium">
              <td class="px-4 py-2 text-gray-900">Total</td>
              <td class="px-4 py-2 text-right text-gray-900">{{ admissions.total }}</td>
              <td class="px-4 py-2 text-right text-gray-500">100.0</td>
            </tr>
          </template>
        </tbody>
      </table>
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
