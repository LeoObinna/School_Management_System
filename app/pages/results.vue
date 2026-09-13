<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { examsApi } from '~/services/exams'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  MySchoolContext,
  ReportCardDetail,
  StudentResultSummary,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['exam_results.view'] })

const auth = useAuthStore()
const isStaff = computed(
  () =>
    auth.hasRole('admin', 'super_admin', 'teacher') ||
    auth.can('exam_results.enter'),
)

// --- School context (studentId / children) --------------------------------
const ctx = ref<MySchoolContext | null>(null)
const ctxLoading = ref(true)
const ctxError = ref<string | null>(null)
const selectedStudentId = ref('')

async function loadContext() {
  ctxLoading.value = true
  ctxError.value = null
  try {
    ctx.value = await examsApi.getMySchoolContext()
    if (ctx.value.studentId) {
      selectedStudentId.value = ctx.value.studentId
    } else if (ctx.value.children[0]) {
      selectedStudentId.value = ctx.value.children[0].id
    }
  } catch (e) {
    ctxError.value = formatApiError(e)
  } finally {
    ctxLoading.value = false
  }
}

// --- Reference data --------------------------------------------------------
const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const currentSessionId = ref('')
const selectedTermId = ref('')

async function loadSessions() {
  try {
    const page = await academicsApi.listSessions({ perPage: 100 })
    sessions.value = page.data
    currentSessionId.value =
      sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
    await loadTerms(currentSessionId.value)
  } catch (e) {
    ctxError.value = formatApiError(e)
  }
}

async function loadTerms(sessionId: string) {
  if (!sessionId) {
    terms.value = []
    return
  }
  try {
    const page = await academicsApi.listTerms({ sessionId, perPage: 50 })
    terms.value = page.data
    selectedTermId.value =
      terms.value.find((t) => t.isCurrent)?.id ?? terms.value[0]?.id ?? ''
  } catch (e) {
    ctxError.value = formatApiError(e)
  }
}

// --- Results + report cards ----------------------------------------------
const summary = ref<StudentResultSummary | null>(null)
const reportCards = ref<ReportCardDetail[]>([])
const loadingData = ref(false)
const dataError = ref<string | null>(null)

async function loadData() {
  if (!selectedStudentId.value || !currentSessionId.value || !selectedTermId.value) {
    summary.value = null
    reportCards.value = []
    return
  }
  loadingData.value = true
  dataError.value = null
  try {
    const [results, cards] = await Promise.all([
      examsApi.getStudentResults(
        selectedStudentId.value,
        currentSessionId.value,
        selectedTermId.value,
      ),
      examsApi.listStudentReportCards(selectedStudentId.value, {
        sessionId: currentSessionId.value,
        termId: selectedTermId.value,
        perPage: 10,
      }),
    ])
    summary.value = results
    reportCards.value = cards.data
  } catch (e) {
    summary.value = null
    reportCards.value = []
    dataError.value = formatApiError(e)
  } finally {
    loadingData.value = false
  }
}

const publicationBadge = computed(() => {
  const status = summary.value?.publicationStatus
  if (!status) return null
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-amber-100 text-amber-800',
    published: 'bg-green-100 text-green-700',
  }
  return { label: status, class: styles[status] ?? 'bg-gray-100 text-gray-700' }
})

const visibleReportCard = computed(() =>
  reportCards.value.find(
    (c) =>
      c.studentId === selectedStudentId.value &&
      c.sessionId === currentSessionId.value &&
      c.termId === selectedTermId.value &&
      c.status === 'published',
  ) ?? null,
)

// --- Lifecycle ------------------------------------------------------------
watch(
  () => currentSessionId.value,
  async (id) => {
    await loadTerms(id)
    await loadData()
  },
)
watch(
  () => selectedTermId.value,
  async () => {
    await loadData()
  },
)
watch(
  () => selectedStudentId.value,
  async () => {
    await loadData()
  },
)

onMounted(async () => {
  await loadContext()
  if (!ctxError.value) {
    await loadSessions()
    if (selectedStudentId.value && currentSessionId.value && selectedTermId.value) {
      await loadData()
    }
  }
})

const isParent = computed(
  () => Boolean(ctx.value && ctx.value.children.length > 0),
)
const isStudent = computed(
  () => Boolean(ctx.value && ctx.value.studentId),
)
const showEmptyState = computed(
  () =>
    !ctxLoading.value &&
    !loadingData.value &&
    !summary.value &&
    !dataError.value &&
    (isStaff.value || isParent.value || isStudent.value) &&
    selectedStudentId.value !== '',
)
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold text-gray-900">My results</h1>
      <p class="mt-1 text-sm text-gray-500">
        Published exam results and report cards for the selected term.
      </p>
    </header>

    <p v-if="ctxLoading" class="text-sm text-gray-500">Loading…</p>
    <p
      v-else-if="ctxError"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ ctxError }}
    </p>

    <div v-else-if="!isStaff && !isParent && !isStudent" class="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
      Your account is not linked to a student profile. Please contact the
      school office if you expected to see results here.
    </div>

    <template v-else>
      <!-- Filters -->
      <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-end gap-3">
          <label v-if="isParent" class="block text-sm">
            <span class="text-gray-700">Child</span>
            <select
              v-model="selectedStudentId"
              class="mt-1 w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option
                v-for="child in ctx?.children ?? []"
                :key="child.id"
                :value="child.id"
              >
                {{ child.name }} ({{ child.admissionNumber ?? '—' }})
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Session</span>
            <select
              v-model="currentSessionId"
              class="mt-1 w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option v-for="s in sessions" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Term</span>
            <select
              v-model="selectedTermId"
              class="mt-1 w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option v-for="t in terms" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </label>
          <span
            v-if="publicationBadge"
            :class="[
              'ml-auto rounded-full px-3 py-1 text-xs font-medium',
              publicationBadge.class,
            ]"
          >
            {{ publicationBadge.label }}
          </span>
        </div>
      </section>

      <p v-if="loadingData" class="text-sm text-gray-500">Loading results…</p>
      <p
        v-else-if="dataError"
        class="rounded-md bg-red-50 p-3 text-sm text-red-700"
      >
        {{ dataError }}
      </p>

      <template v-else-if="summary">
        <!-- Summary -->
        <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 class="text-base font-medium text-gray-900">
                {{ summary.studentName }}
              </h2>
              <p class="text-xs text-gray-500">
                {{ summary.admissionNumber }} · {{ summary.className ?? '—' }} ·
                {{ summary.sessionName }}
                <template v-if="summary.termName">
                  · {{ summary.termName }}
                </template>
              </p>
            </div>
            <dl class="grid grid-cols-3 gap-4 text-right text-sm">
              <div>
                <dt class="text-xs text-gray-500">Total</dt>
                <dd class="font-medium text-gray-900">
                  {{ summary.totalScore ?? '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-500">Average</dt>
                <dd class="font-medium text-gray-900">
                  {{ summary.averageScore ?? '—' }}%
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-500">Grade</dt>
                <dd class="font-medium text-gray-900">
                  {{ summary.overallGrade ?? '—' }}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <!-- Subject results -->
        <section
          v-if="summary.subjects.length"
          class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
        >
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-4 py-3 text-left">Subject</th>
                <th class="px-4 py-3 text-right">Assessment</th>
                <th class="px-4 py-3 text-right">Exam</th>
                <th class="px-4 py-3 text-right">Total</th>
                <th class="px-4 py-3 text-right">%</th>
                <th class="px-4 py-3 text-right">Grade</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="subject in summary.subjects"
                :key="subject.subjectId"
                class="hover:bg-gray-50"
              >
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900">
                    {{ subject.subjectName }}
                  </div>
                  <div
                    v-if="subject.subjectCode"
                    class="text-xs text-gray-500"
                  >
                    {{ subject.subjectCode }}
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-gray-700">
                  {{ subject.assessmentScores.reduce(
                    (acc, s) => acc + Number(s.score), 0) }} /
                  {{ subject.assessmentScores.reduce(
                    (acc, s) => acc + Number(s.maxScore), 0) }}
                </td>
                <td class="px-4 py-3 text-right text-gray-700">
                  {{ subject.examScores.reduce(
                    (acc, s) => acc + Number(s.score), 0) }} /
                  {{ subject.examScores.reduce(
                    (acc, s) => acc + Number(s.maxScore), 0) }}
                </td>
                <td class="px-4 py-3 text-right font-medium text-gray-900">
                  {{ subject.totalScore }} / {{ subject.maxScore }}
                </td>
                <td class="px-4 py-3 text-right text-gray-900">
                  {{ subject.percentage }}%
                </td>
                <td class="px-4 py-3 text-right font-medium text-gray-900">
                  {{ subject.grade ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Report card -->
        <section
          v-if="visibleReportCard"
          class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div class="flex items-baseline justify-between">
            <h2 class="text-base font-medium text-gray-900">Report card</h2>
            <span
              class="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
            >
              Published
            </span>
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt class="text-xs text-gray-500">Total</dt>
              <dd class="font-medium text-gray-900">
                {{ visibleReportCard.totalScore ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500">Average</dt>
              <dd class="font-medium text-gray-900">
                {{ visibleReportCard.averageScore ?? '—' }}%
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500">Grade</dt>
              <dd class="font-medium text-gray-900">
                {{ visibleReportCard.overallGrade ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500">Published</dt>
              <dd class="font-medium text-gray-900">
                {{ visibleReportCard.publishedAt
                  ? new Date(visibleReportCard.publishedAt).toLocaleDateString()
                  : '—' }}
              </dd>
            </div>
          </dl>
          <div
            v-if="visibleReportCard.attendanceSummary"
            class="mt-3 text-sm text-gray-700"
          >
            <span class="font-medium">Attendance:</span>
            {{ visibleReportCard.attendanceSummary }}
          </div>
          <div
            v-if="visibleReportCard.teacherRemark"
            class="mt-3 text-sm text-gray-700"
          >
            <span class="font-medium">Teacher's remark:</span>
            {{ visibleReportCard.teacherRemark }}
          </div>
          <div
            v-if="visibleReportCard.principalRemark"
            class="mt-2 text-sm text-gray-700"
          >
            <span class="font-medium">Principal's remark:</span>
            {{ visibleReportCard.principalRemark }}
          </div>
        </section>

        <p
          v-else-if="summary.publicationStatus === 'published'"
          class="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
        >
          Results are published, but no report card has been generated yet.
        </p>
      </template>

      <p
        v-else-if="showEmptyState"
        class="rounded-md bg-gray-50 p-4 text-sm text-gray-600"
      >
        No published results found for the selected term.
      </p>
    </template>
  </div>
</template>
