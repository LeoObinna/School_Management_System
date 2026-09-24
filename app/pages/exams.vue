<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { examsApi } from '~/services/exams'
import { formatApiError } from '~/utils/errors'
import { EXAM_STATUSES } from '~/shared/schemas'
import type {
  AcademicSession,
  AssessmentType,
  ExamDetail,
  ExamListItem,
  GradingScaleDetail,
  ReportCardDetail,
  ResultPublicationDetail,
  SchoolClass,
  Subject,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['exams.view'] })

const auth = useAuthStore()
const isAdmin = computed(
  () => auth.can('exams.create') || auth.can('exam_results.approve'),
)
const canEnterScores = computed(() => auth.can('exam_results.enter'))
const canSubmit = computed(() => auth.can('exam_results.submit'))
const canApprove = computed(() => auth.can('exam_results.approve'))
const canPublish = computed(() => auth.can('exam_results.publish'))
const canGenerateReport = computed(() => auth.can('report_cards.generate'))

// --- Reference data --------------------------------------------------------
const loading = ref(false)
const loadError = ref<string | null>(null)
const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const classes = ref<SchoolClass[]>([])
const subjects = ref<Subject[]>([])
const assessmentTypes = ref<AssessmentType[]>([])
const gradingScales = ref<GradingScaleDetail[]>([])
const exams = ref<ExamListItem[]>([])
const publications = ref<ResultPublicationDetail[]>([])

const filters = reactive({ sessionId: '', classId: '', status: '' })
const currentSessionId = ref('')
const firstTermId = ref('')

async function loadBase() {
  loading.value = true
  loadError.value = null
  try {
    const [sessPage, classPage, subjectPage, typesPage, scalesPage] =
      await Promise.all([
        academicsApi.listSessions({ perPage: 100 }),
        academicsApi.listClasses({ perPage: 100, isActive: true }),
        academicsApi.listSubjects({ perPage: 200, isActive: true }),
        examsApi.listAssessmentTypes({ perPage: 100 }),
        examsApi.listGradingScales({ perPage: 50 }),
      ])
    sessions.value = sessPage.data
    classes.value = classPage.data
    subjects.value = subjectPage.data
    assessmentTypes.value = typesPage.data
    gradingScales.value = scalesPage.data
    currentSessionId.value =
      sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
    filters.sessionId = currentSessionId.value
    await loadTerms(currentSessionId.value)
    await loadExams()
    await loadPublications()
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function loadTerms(sessionId: string) {
  if (!sessionId) {
    terms.value = []
    firstTermId.value = ''
    return
  }
  const page = await academicsApi.listTerms({ sessionId, perPage: 50 })
  terms.value = page.data
  firstTermId.value =
    terms.value.find((t) => t.isCurrent)?.id ?? terms.value[0]?.id ?? ''
}

async function loadExams() {
  try {
    const res = await examsApi.listExams({
      sessionId: filters.sessionId || undefined,
      classId: filters.classId || undefined,
      status: (filters.status || undefined) as never,
    })
    exams.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function loadPublications() {
  if (!filters.sessionId || !firstTermId.value) {
    publications.value = []
    return
  }
  try {
    const res = await examsApi.listPublications({
      sessionId: filters.sessionId,
      termId: firstTermId.value,
    })
    publications.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

watch(
  () => filters.sessionId,
  async (id) => {
    await loadTerms(id)
    await Promise.all([loadExams(), loadPublications()])
  },
)
watch(
  () => [filters.classId, filters.status],
  async () => loadExams(),
)

onMounted(loadBase)

function className(id: string) {
  return classes.value.find((c) => c.id === id)?.name ?? '—'
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-700',
}

// --- Create / edit exam --------------------------------------------------
const editOpen = ref(false)
const editing = ref<ExamListItem | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  classId: '',
  termId: '',
  name: '',
  startDate: '',
  endDate: '',
  status: 'closed' as (typeof EXAM_STATUSES)[number],
})

function openCreate() {
  editing.value = null
  Object.assign(form, {
    classId: '',
    termId: firstTermId.value,
    name: '',
    startDate: '',
    endDate: '',
    status: 'closed',
  })
  formError.value = null
  editOpen.value = true
}

function openEdit(e: ExamListItem) {
  editing.value = e
  Object.assign(form, {
    classId: e.classId,
    termId: e.termId ?? '',
    name: e.name,
    startDate: e.startDate ?? '',
    endDate: e.endDate ?? '',
    status: e.status,
  })
  formError.value = null
  editOpen.value = true
}

async function submitForm() {
  if (!filters.sessionId) return
  saving.value = true
  formError.value = null
  const payload = {
    sessionId: filters.sessionId,
    termId: form.termId || null,
    classId: form.classId,
    name: form.name.trim(),
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    status: form.status,
  }
  try {
    if (editing.value) {
      await examsApi.updateExam(editing.value.id, payload)
    } else {
      await examsApi.createExam(payload)
    }
    editOpen.value = false
    await loadExams()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function toggleExamStatus(e: ExamListItem) {
  try {
    if (e.status === 'open') {
      await examsApi.closeExam(e.id)
    } else {
      await examsApi.openExam(e.id)
    }
    await loadExams()
  } catch (err) {
    loadError.value = formatApiError(err)
  }
}

// --- Manage exam subjects + scores ----------------------------------------
const manageOpen = ref(false)
const managing = ref<ExamDetail | null>(null)
const manageError = ref<string | null>(null)
const subjectForm = reactive({
  subjectId: '',
  maxScore: '100',
  examDate: '',
})

async function openManage(e: ExamListItem) {
  manageError.value = null
  try {
    managing.value = await examsApi.getExam(e.id)
    manageOpen.value = true
  } catch (err) {
    manageError.value = formatApiError(err)
  }
}

async function addSubject() {
  if (!managing.value || !subjectForm.subjectId) return
  try {
    managing.value = await examsApi.addExamSubject(
      managing.value.id,
      {
        subjectId: subjectForm.subjectId,
        maxScore: subjectForm.maxScore,
        examDate: subjectForm.examDate || null,
      },
    )
    Object.assign(subjectForm, { subjectId: '', maxScore: '100', examDate: '' })
  } catch (err) {
    manageError.value = formatApiError(err)
  }
}

async function removeSubject(subjectId: string) {
  if (!managing.value) return
  if (!confirm('Remove this subject from the exam?')) return
  try {
    await examsApi.removeExamSubject(managing.value.id, subjectId)
    managing.value = await examsApi.getExam(managing.value.id)
  } catch (err) {
    manageError.value = formatApiError(err)
  }
}

// --- Publication workflow --------------------------------------------------
async function submitPub(pub: ResultPublicationDetail) {
  try {
    await examsApi.submitPublication(pub.id)
    await loadPublications()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
async function approvePub(pub: ResultPublicationDetail) {
  try {
    await examsApi.approvePublication(pub.id)
    await loadPublications()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
async function publishPub(pub: ResultPublicationDetail) {
  try {
    await examsApi.publishPublication(pub.id)
    await loadPublications()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// --- Report cards ----------------------------------------------------------
const reportStudentId = ref('')
const reportCard = ref<ReportCardDetail | null>(null)
const reportError = ref<string | null>(null)
const reportBusy = ref(false)

async function generateReport() {
  if (!reportStudentId.value || !filters.sessionId || !firstTermId.value) return
  reportBusy.value = true
  reportError.value = null
  try {
    // Look up the student's class enrollment by listing results first.
    const summary = await examsApi.getStudentResults(
      reportStudentId.value,
      filters.sessionId,
      firstTermId.value,
    )
    if (!summary.classId) {
      throw new Error('Student is not actively enrolled.')
    }
    reportCard.value = await examsApi.generateReportCard(
      reportStudentId.value,
      {
        studentId: reportStudentId.value,
        sessionId: filters.sessionId,
        termId: firstTermId.value,
        classId: summary.classId,
        sectionId: summary.publicationStatus === 'published' ? null : null,
      },
    )
  } catch (e) {
    reportError.value = formatApiError(e)
  } finally {
    reportBusy.value = false
  }
}

async function publishReport() {
  if (!reportCard.value) return
  try {
    reportCard.value = await examsApi.publishReportCard(reportCard.value.id)
  } catch (e) {
    reportError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Exams & Results</h1>
        <p class="mt-1 text-sm text-gray-500">
          Configure exams, enter scores and publish class results.
        </p>
      </div>
      <button
        v-if="isAdmin"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New exam
      </button>
    </div>

    <div class="flex flex-wrap gap-3">
      <select v-model="filters.sessionId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">All sessions</option>
        <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <select v-model="filters.classId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">All classes</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-model="filters.status" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">All statuses</option>
        <option v-for="s in EXAM_STATUSES" :key="s" :value="s">
          {{ s.charAt(0).toUpperCase() + s.slice(1) }}
        </option>
      </select>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>

    <div v-else-if="exams.length === 0" class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
      No exams found for the selected filters.
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="e in exams"
        :key="e.id"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-medium text-gray-900">{{ e.name }}</h2>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_STYLES[e.status]"
              >
                {{ e.status }}
              </span>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              {{ e.className }} · {{ e.sessionName }}
              <span v-if="e.termName"> · {{ e.termName }}</span>
              · {{ e.subjectCount }} subject(s)
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              @click="toggleExamStatus(e)"
              v-if="isAdmin"
            >
              {{ e.status === 'open' ? 'Close' : 'Open' }}
            </button>
            <button
              class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              @click="openEdit(e)"
              v-if="isAdmin"
            >
              Edit
            </button>
            <button
              class="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              @click="openManage(e)"
            >
              Manage subjects & scores
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- Result publications panel -->
    <section v-if="isAdmin || canSubmit" class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 class="text-base font-medium text-gray-900">Result publications</h2>
      <p class="mt-1 text-xs text-gray-500">
        Submit a class's results for approval, then approve and publish.
      </p>
      <div v-if="publications.length === 0" class="mt-3 text-sm text-gray-500">
        No publications for the current session/term.
      </div>
      <ul v-else class="mt-3 space-y-2">
        <li
          v-for="pub in publications"
          :key="pub.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-100 p-3"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">
              {{ pub.className }}
              <span v-if="pub.sectionName"> · {{ pub.sectionName }}</span>
            </p>
            <p class="text-xs text-gray-500">
              {{ pub.sessionName }} · {{ pub.termName }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="STATUS_STYLES[pub.status]"
            >
              {{ pub.status }}
            </span>
            <button
              v-if="pub.status === 'draft' && (canSubmit || isAdmin)"
              class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              @click="submitPub(pub)"
            >
              Submit
            </button>
            <button
              v-if="pub.status === 'submitted' && canApprove"
              class="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              @click="approvePub(pub)"
            >
              Approve
            </button>
            <button
              v-if="pub.status === 'approved' && canPublish"
              class="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              @click="publishPub(pub)"
            >
              Publish
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Report card generator -->
    <section v-if="canGenerateReport" class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 class="text-base font-medium text-gray-900">Generate report card</h2>
      <p class="mt-1 text-xs text-gray-500">
        Compute and (optionally) publish a student's report card from
        stored assessment + exam scores.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <input
          v-model="reportStudentId"
          placeholder="Student UUID"
          class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="generateReport"
          :disabled="reportBusy"
        >
          {{ reportBusy ? 'Generating…' : 'Generate' }}
        </button>
      </div>
      <p v-if="reportError" class="mt-2 text-sm text-red-700">{{ reportError }}</p>
      <div v-if="reportCard" class="mt-4 rounded-md border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-900">
          {{ reportCard.studentName }} ({{ reportCard.admissionNumber }})
        </p>
        <p class="text-xs text-gray-500">
          {{ reportCard.className }} · {{ reportCard.termName }}
        </p>
        <p class="mt-2 text-sm">
          Total: {{ reportCard.totalScore ?? '—' }} ·
          Average: {{ reportCard.averageScore ?? '—' }}% ·
          Grade: {{ reportCard.overallGrade ?? '—' }}
        </p>
        <button
          v-if="reportCard.status !== 'published' && canPublish"
          class="mt-3 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          @click="publishReport"
        >
          Publish
        </button>
      </div>
    </section>

    <!-- Create / edit exam modal -->
    <div
      v-if="editOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="editOpen = false"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 class="text-lg font-medium text-gray-900">
          {{ editing ? 'Edit exam' : 'New exam' }}
        </h3>
        <p v-if="formError" class="mt-2 text-sm text-red-700">{{ formError }}</p>
        <div class="mt-4 space-y-3">
          <label class="block text-sm">
            <span class="text-gray-700">Class</span>
            <select v-model="form.classId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select class</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Term</span>
            <select v-model="form.termId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">No term</option>
              <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Name</span>
            <input v-model="form.name" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-gray-700">Start date</span>
              <input v-model="form.startDate" type="date" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </label>
            <label class="block text-sm">
              <span class="text-gray-700">End date</span>
              <input v-model="form.endDate" type="date" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            </label>
          </div>
          <label class="block text-sm">
            <span class="text-gray-700">Status</span>
            <select v-model="form.status" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option v-for="s in EXAM_STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border border-gray-300 px-4 py-2 text-sm" @click="editOpen = false">
            Cancel
          </button>
          <button
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            :disabled="saving"
            @click="submitForm"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Manage exam subjects + scores modal -->
    <div
      v-if="manageOpen && managing"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="manageOpen = false"
    >
      <div class="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <h3 class="text-lg font-medium text-gray-900">
          {{ managing.name }} · {{ className(managing.classId) }}
        </h3>
        <p v-if="manageError" class="mt-2 text-sm text-red-700">{{ manageError }}</p>

        <div class="mt-4">
          <h4 class="text-sm font-medium text-gray-900">Exam subjects</h4>
          <ul class="mt-2 space-y-1">
            <li
              v-for="s in managing.subjects"
              :key="s.subjectId"
              class="flex items-center justify-between rounded-md border border-gray-100 p-2 text-sm"
            >
              <span>
                {{ s.subjectName }}
                <span class="text-xs text-gray-500">/ max {{ s.maxScore }}</span>
              </span>
              <button
                v-if="isAdmin"
                class="text-xs text-red-600 hover:underline"
                @click="removeSubject(s.subjectId)"
              >
                Remove
              </button>
            </li>
          </ul>
          <div v-if="isAdmin" class="mt-2 flex flex-wrap gap-2">
            <select v-model="subjectForm.subjectId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Add subject…</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <input v-model="subjectForm.maxScore" placeholder="Max score" class="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input v-model="subjectForm.examDate" type="date" class="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button class="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700" @click="addSubject">
              Add
            </button>
          </div>
        </div>

        <div v-if="canEnterScores" class="mt-6">
          <h4 class="text-sm font-medium text-gray-900">Score entry</h4>
          <p class="mt-1 text-xs text-gray-500">
            Use the dedicated score-entry page to enter assessment and exam
            scores against your class roster.
          </p>
          <NuxtLink
            to="/exam-results/enter"
            class="mt-2 inline-block rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          >
            Open score entry →
          </NuxtLink>
        </div>

        <div class="mt-6 flex justify-end">
          <button class="rounded-md border border-gray-300 px-4 py-2 text-sm" @click="manageOpen = false">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
