<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { admissionsApi } from '~/services/admissions'
import { academicsApi } from '~/services/academics'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  AdmissionApplicationDetail,
  AdmissionApplicationListItem,
  AdmissionAssessment,
  AdmissionAssessmentResult,
  AdmissionAssessmentType,
  AdmissionStatus,
  SchoolClass,
  Section,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['admissions.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('admissions.create'))
const canUpdate = computed(() => auth.can('admissions.update'))
const canReview = computed(() => auth.can('admissions.review'))
const canApprove = computed(() => auth.can('admissions.approve'))
const canReject = computed(() => auth.can('admissions.reject'))
const canViewDocs = computed(() => auth.can('admissions.documents.view'))
const canManageDocs = computed(() =>
  auth.can('admissions.documents.manage'),
)

// ---------------------------------------------------------------------------
// Catalogs + list
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const applications = ref<AdmissionApplicationListItem[]>([])

const sessions = ref<AcademicSession[]>([])
const classes = ref<SchoolClass[]>([])
const sections = ref<Section[]>([])
const terms = ref<Term[]>([])

const page = ref(1)
const perPage = 20
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const filters = reactive({
  search: '',
  status: '' as '' | AdmissionStatus,
  sessionId: '',
  intendedClassId: '',
})

const STATUS_LABELS: Record<AdmissionStatus, string> = {
  applied: 'Applied',
  documents_submitted: 'Documents submitted',
  under_review: 'Under review',
  assessment_scheduled: 'Assessment scheduled',
  assessed: 'Assessed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
  admitted: 'Admitted',
  enrolled: 'Enrolled',
  withdrawn: 'Withdrawn',
}

const STATUS_BADGES: Record<AdmissionStatus, string> = {
  applied: 'bg-blue-50 text-blue-700',
  documents_submitted: 'bg-indigo-50 text-indigo-700',
  under_review: 'bg-amber-50 text-amber-700',
  assessment_scheduled: 'bg-violet-50 text-violet-700',
  assessed: 'bg-violet-100 text-violet-800',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  waitlisted: 'bg-yellow-50 text-yellow-800',
  admitted: 'bg-emerald-50 text-emerald-700',
  enrolled: 'bg-emerald-100 text-emerald-800',
  withdrawn: 'bg-gray-100 text-gray-600',
}

const DECIDABLE: AdmissionStatus[] = [
  'applied',
  'documents_submitted',
  'under_review',
  'assessment_scheduled',
  'assessed',
  'waitlisted',
]
const OPEN: AdmissionStatus[] = [...DECIDABLE, 'accepted']

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const result = await admissionsApi.listApplications({
      page: page.value,
      perPage,
      search: filters.search || undefined,
      status: filters.status || undefined,
      sessionId: filters.sessionId || undefined,
      intendedClassId: filters.intendedClassId || undefined,
    })
    applications.value = result.data
    total.value = result.meta.total
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function loadCatalogs() {
  try {
    const [sessionPage, classPage, sectionPage, termPage] =
      await Promise.all([
        academicsApi.listSessions({ perPage: 100 }),
        academicsApi.listClasses({ perPage: 200, isActive: true }),
        academicsApi.listSections({ perPage: 500, isActive: true }),
        academicsApi.listTerms({ perPage: 200, isActive: true }),
      ])
    sessions.value = sessionPage.data
    classes.value = classPage.data
    sections.value = sectionPage.data
    terms.value = termPage.data
  } catch {
    // Catalog failure should not block the list screen.
  }
}

function applyFilters() {
  page.value = 1
  void loadAll()
}

watch(
  () => [filters.status, filters.sessionId, filters.intendedClassId],
  () => applyFilters(),
)

onMounted(() => {
  void loadCatalogs()
  void loadAll()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function fmtDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function askNotes(title: string, required: boolean): string | null {
  if (typeof window === 'undefined') return null
  const notes = window.prompt(
    required
      ? `${title}\nReason / notes are required:`
      : `${title}\nNotes (optional):`,
    '',
  )
  if (notes === null) return null
  const trimmed = notes.trim()
  if (required && !trimmed) return null
  return trimmed
}

function refreshDetail(detail: AdmissionApplicationDetail) {
  selected.value = detail
}

// ---------------------------------------------------------------------------
// Application create / edit modal
// ---------------------------------------------------------------------------

const formModalOpen = ref(false)
const editingId = ref<string | null>(null)
const formSaving = ref(false)
const formError = ref<string | null>(null)
const appForm = reactive({
  sessionId: '',
  intendedClassId: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  dateOfBirth: '',
  nationality: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  address: '',
  previousSchool: '',
})

function resetAppForm() {
  Object.assign(appForm, {
    sessionId: '',
    intendedClassId: '',
    firstName: '',
    lastName: '',
    otherNames: '',
    gender: '',
    dateOfBirth: '',
    nationality: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    address: '',
    previousSchool: '',
  })
}

function openCreate() {
  editingId.value = null
  resetAppForm()
  appForm.sessionId = filters.sessionId
  appForm.intendedClassId = filters.intendedClassId
  formError.value = null
  formModalOpen.value = true
}

function openEdit(row: AdmissionApplicationListItem) {
  editingId.value = row.id
  Object.assign(appForm, {
    sessionId: row.sessionId ?? '',
    intendedClassId: row.intendedClassId ?? '',
    firstName: row.firstName,
    lastName: row.lastName,
    otherNames: row.otherNames ?? '',
    gender: row.gender ?? '',
    dateOfBirth: row.dateOfBirth ?? '',
    nationality: row.nationality ?? '',
    guardianName: row.guardianName ?? '',
    guardianPhone: row.guardianPhone ?? '',
    guardianEmail: row.guardianEmail ?? '',
    address: row.address ?? '',
    previousSchool: row.previousSchool ?? '',
  })
  formError.value = null
  formModalOpen.value = true
}

async function submitAppForm() {
  formSaving.value = true
  formError.value = null
  const body = {
    sessionId: appForm.sessionId || null,
    intendedClassId: appForm.intendedClassId || null,
    firstName: appForm.firstName.trim(),
    lastName: appForm.lastName.trim(),
    otherNames: appForm.otherNames.trim() || null,
    gender: appForm.gender || null,
    dateOfBirth: appForm.dateOfBirth || null,
    nationality: appForm.nationality.trim() || null,
    guardianName: appForm.guardianName.trim() || null,
    guardianPhone: appForm.guardianPhone.trim() || null,
    guardianEmail: appForm.guardianEmail.trim() || null,
    address: appForm.address.trim() || null,
    previousSchool: appForm.previousSchool.trim() || null,
  }
  try {
    if (editingId.value) {
      await admissionsApi.updateApplication(editingId.value, body)
    } else {
      await admissionsApi.createApplication(body)
    }
    formModalOpen.value = false
    await loadAll()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    formSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

const detailOpen = ref(false)
const detailLoading = ref(false)
const selected = ref<AdmissionApplicationDetail | null>(null)

async function openDetail(row: AdmissionApplicationListItem) {
  detailOpen.value = true
  detailLoading.value = true
  selected.value = null
  try {
    selected.value = await admissionsApi.getApplication(row.id)
  } catch (e) {
    loadError.value = formatApiError(e)
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

async function runAction(
  fn: () => Promise<AdmissionApplicationDetail>,
  confirmMessage?: string,
) {
  if (confirmMessage && !window.confirm(confirmMessage)) return
  try {
    refreshDetail(await fn())
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

function markReviewed() {
  if (!selected.value) return
  const notes = askNotes('Mark this application as under review?', false)
  if (notes === null) return
  void runAction(() =>
    admissionsApi.review(selected.value!.id, notes ? { notes } : {}),
  )
}

function approve() {
  if (!selected.value) return
  const notes = askNotes('Accept this application?', true)
  if (notes === null) return
  void runAction(() =>
    admissionsApi.approve(selected.value!.id, { decisionNotes: notes }),
  )
}

function reject() {
  if (!selected.value) return
  const notes = askNotes('Reject this application? This records a decision.', true)
  if (notes === null) return
  void runAction(() =>
    admissionsApi.reject(selected.value!.id, { decisionNotes: notes }),
  )
}

function waitlist() {
  if (!selected.value) return
  const notes = askNotes('Add this application to the waitlist?', false)
  if (notes === null) return
  void runAction(() =>
    admissionsApi.waitlist(
      selected.value!.id,
      notes ? { decisionNotes: notes } : {},
    ),
  )
}

function withdraw() {
  if (!selected.value) return
  const notes = askNotes(
    'Withdraw this application? This cannot be undone.',
    false,
  )
  if (notes === null) return
  void runAction(() =>
    admissionsApi.withdraw(
      selected.value!.id,
      notes ? { decisionNotes: notes } : {},
    ),
  )
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

const ASSESSMENT_TYPES: { value: AdmissionAssessmentType; label: string }[] = [
  { value: 'exam', label: 'Entrance exam' },
  { value: 'interview', label: 'Interview' },
  { value: 'test', label: 'Placement test' },
  { value: 'other', label: 'Other' },
]
const ASSESSMENT_RESULTS: {
  value: AdmissionAssessmentResult
  label: string
}[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'consider', label: 'Consider' },
]

const assessmentModalOpen = ref(false)
const assessmentSaving = ref(false)
const assessmentError = ref<string | null>(null)
const editingAssessmentId = ref<string | null>(null)
const assessmentForm = reactive({
  title: '',
  assessmentType: 'interview' as AdmissionAssessmentType,
  scheduledAt: '',
  score: '',
  result: '' as '' | AdmissionAssessmentResult,
  notes: '',
})

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openAddAssessment() {
  editingAssessmentId.value = null
  Object.assign(assessmentForm, {
    title: '',
    assessmentType: 'interview',
    scheduledAt: '',
    score: '',
    result: '',
    notes: '',
  })
  assessmentError.value = null
  assessmentModalOpen.value = true
}

function openEditAssessment(a: AdmissionAssessment) {
  editingAssessmentId.value = a.id
  Object.assign(assessmentForm, {
    title: a.title,
    assessmentType: (a.assessmentType ?? 'other') as AdmissionAssessmentType,
    scheduledAt: toLocalInput(a.scheduledAt),
    score: a.score ?? '',
    result: a.result ?? '',
    notes: a.notes ?? '',
  })
  assessmentError.value = null
  assessmentModalOpen.value = true
}

async function submitAssessment() {
  if (!selected.value) return
  assessmentSaving.value = true
  assessmentError.value = null
  const body = {
    title: assessmentForm.title.trim(),
    assessmentType: assessmentForm.assessmentType,
    scheduledAt: assessmentForm.scheduledAt
      ? new Date(assessmentForm.scheduledAt).toISOString()
      : null,
    score: assessmentForm.score.trim() || null,
    result: assessmentForm.result || null,
    notes: assessmentForm.notes.trim() || null,
  }
  try {
    const detail = editingAssessmentId.value
      ? await admissionsApi.updateAssessment(
          selected.value.id,
          editingAssessmentId.value,
          body,
        )
      : await admissionsApi.addAssessment(selected.value.id, body)
    refreshDetail(detail)
    assessmentModalOpen.value = false
    await loadAll()
  } catch (e) {
    assessmentError.value = formatApiError(e)
  } finally {
    assessmentSaving.value = false
  }
}

async function removeAssessment(a: AdmissionAssessment) {
  if (!selected.value) return
  if (!window.confirm(`Delete assessment "${a.title}"?`)) return
  try {
    refreshDetail(
      await admissionsApi.deleteAssessment(selected.value.id, a.id),
    )
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES = [
  'Birth certificate',
  'Previous report card / transcript',
  'Passport photograph',
  'Recommendation letter',
  'Immunization record',
  'Other',
]

const uploadType = ref<string>(DOCUMENT_TYPES[0] ?? 'Other')
const uploadFile = ref<File | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  uploadFile.value = input.files?.[0] ?? null
}

async function submitUpload() {
  if (!selected.value) return
  if (!uploadFile.value) {
    uploadError.value = 'Choose a file to upload.'
    return
  }
  uploading.value = true
  uploadError.value = null
  const file = uploadFile.value
  const form = new FormData()
  form.append('documentType', uploadType.value)
  form.append('file', file)
  try {
    refreshDetail(
      await admissionsApi.uploadDocument(selected.value.id, form),
    )
    uploadFile.value = null
    await loadAll()
  } catch (e) {
    uploadError.value = formatApiError(e)
  } finally {
    uploading.value = false
  }
}

async function removeDocument(documentId: string, fileName: string) {
  if (!selected.value) return
  if (!window.confirm(`Delete document "${fileName}"? The stored file will be removed.`)) {
    return
  }
  try {
    const detail = await admissionsApi.deleteDocument(
      selected.value.id,
      documentId,
    )
    refreshDetail(detail)
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

function fmtBytes(value: number | null): string {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Enrollment conversion
// ---------------------------------------------------------------------------

const enrollModalOpen = ref(false)
const enrollSaving = ref(false)
const enrollError = ref<string | null>(null)
const enrollForm = reactive({
  admissionNumber: '',
  sessionId: '',
  classId: '',
  sectionId: '',
  termId: '',
  rollNumber: '',
  enrollmentDate: '',
  createGuardianParent: false,
})

const enrollSections = computed(() =>
  sections.value.filter((s) => s.classId === enrollForm.classId),
)
const enrollTerms = computed(() =>
  terms.value.filter((t) => t.sessionId === enrollForm.sessionId),
)

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function openEnroll() {
  if (!selected.value) return
  const app = selected.value
  enrollForm.admissionNumber = ''
  enrollForm.sessionId = app.sessionId ?? sessions.value[0]?.id ?? ''
  enrollForm.classId = app.intendedClassId ?? classes.value[0]?.id ?? ''
  enrollForm.sectionId = ''
  enrollForm.termId = ''
  enrollForm.rollNumber = ''
  enrollForm.enrollmentDate = today()
  enrollForm.createGuardianParent = Boolean(app.guardianName)
  enrollError.value = null
  enrollModalOpen.value = true
}

async function submitEnroll() {
  if (!selected.value) return
  enrollSaving.value = true
  enrollError.value = null
  try {
    const result = await admissionsApi.enroll(selected.value.id, {
      admissionNumber: enrollForm.admissionNumber.trim(),
      sessionId: enrollForm.sessionId,
      classId: enrollForm.classId,
      sectionId: enrollForm.sectionId || null,
      termId: enrollForm.termId || null,
      rollNumber: enrollForm.rollNumber.trim() || null,
      enrollmentDate: enrollForm.enrollmentDate,
      createGuardianParent: enrollForm.createGuardianParent,
    })
    enrollModalOpen.value = false
    detailOpen.value = false
    notice.value = `Enrolled ${result.student.firstName} ${result.student.lastName} as ${result.student.admissionNumber}.`
    await loadAll()
  } catch (e) {
    enrollError.value = formatApiError(e)
  } finally {
    enrollSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Admissions</h1>
        <p class="mt-1 text-sm text-gray-500">
          Applications, documents, assessments and enrollment conversion.
        </p>
      </div>
      <button
        v-if="canCreate"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New application
      </button>
    </div>

    <p
      v-if="notice"
      class="rounded-md bg-green-50 p-3 text-sm text-green-800"
      @click="notice = null"
    >
      {{ notice }}
    </p>
    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- Filters -->
    <form class="flex flex-wrap gap-3" @submit.prevent="applyFilters">
      <input
        v-model="filters.search"
        type="search"
        placeholder="Search name, application no., guardian…"
        class="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        v-model="filters.status"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option
          v-for="(label, key) in STATUS_LABELS"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
      <select
        v-model="filters.sessionId"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All sessions</option>
        <option v-for="s in sessions" :key="s.id" :value="s.id">
          {{ s.name }}
        </option>
      </select>
      <select
        v-model="filters.intendedClassId"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All intended classes</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">
          {{ c.name }}
        </option>
      </select>
      <button
        type="submit"
        class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
      >
        Search
      </button>
    </form>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
    <div
      v-else-if="applications.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"
    >
      No applications found.
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Application</th>
            <th class="px-4 py-3 font-medium">Applicant</th>
            <th class="px-4 py-3 font-medium">Intended</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Files</th>
            <th class="px-4 py-3 font-medium">Created</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="a in applications"
            :key="a.id"
            class="hover:bg-gray-50"
          >
            <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">
              {{ a.applicationNumber }}
            </td>
            <td class="px-4 py-3">
              <button class="font-medium text-indigo-700 hover:underline" @click="openDetail(a)">
                {{ a.applicantName }}
              </button>
              <p v-if="a.previousSchool" class="text-xs text-gray-400">
                {{ a.previousSchool }}
              </p>
            </td>
            <td class="px-4 py-3 text-gray-600">
              {{ a.className ?? '—' }}
              <span v-if="a.sessionName" class="block text-xs text-gray-400">{{ a.sessionName }}</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_BADGES[a.status]"
              >
                {{ STATUS_LABELS[a.status] }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500">
              {{ a.documentCount }} doc<span v-if="a.assessmentCount !== 0"> · {{ a.assessmentCount }} assess.</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
              {{ fmtDate(a.createdAt) }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="canUpdate && OPEN.includes(a.status)"
                class="text-xs text-gray-600 hover:underline"
                @click="openEdit(a)"
              >
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > 0" class="flex items-center justify-between text-sm text-gray-600">
      <span>{{ total }} application(s) · page {{ page }} of {{ lastPage }}</span>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page--; void loadAll()"
        >
          Previous
        </button>
        <button
          :disabled="page >= lastPage"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page++; void loadAll()"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create / edit application -->
    <BaseModal
      :open="formModalOpen"
      :title="editingId ? 'Edit application' : 'New application'"
      wide
      @close="formModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitAppForm">
        <p v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">First name *</span>
            <input v-model="appForm.firstName" required maxlength="150" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Last name *</span>
            <input v-model="appForm.lastName" required maxlength="150" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Other names</span>
            <input v-model="appForm.otherNames" maxlength="150" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Date of birth</span>
            <input v-model="appForm.dateOfBirth" type="date" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Gender</span>
            <select v-model="appForm.gender" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Unspecified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Nationality</span>
            <input v-model="appForm.nationality" maxlength="100" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Academic session</span>
            <select v-model="appForm.sessionId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">None</option>
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Intended class</span>
            <select v-model="appForm.intendedClassId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">None</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Guardian name</span>
            <input v-model="appForm.guardianName" maxlength="255" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Guardian phone</span>
            <input v-model="appForm.guardianPhone" maxlength="50" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Guardian email</span>
            <input v-model="appForm.guardianEmail" type="email" maxlength="255" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Previous school</span>
            <input v-model="appForm.previousSchool" maxlength="255" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
        </div>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Address</span>
          <textarea v-model="appForm.address" rows="2" maxlength="2000" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" @click="formModalOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="formSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ formSaving ? 'Saving…' : 'Save application' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Detail -->
    <BaseModal
      :open="detailOpen"
      :title="selected ? `Application ${selected.applicationNumber}` : 'Application'"
      wide
      @close="detailOpen = false"
    >
      <div v-if="detailLoading" class="text-sm text-gray-500">Loading…</div>
      <div v-else-if="selected" class="space-y-6">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="rounded-full px-3 py-1 text-xs font-medium"
            :class="STATUS_BADGES[selected.status]"
          >
            {{ STATUS_LABELS[selected.status] }}
          </span>
          <span class="text-sm text-gray-500">
            {{ selected.firstName }} {{ selected.lastName }}
            <template v-if="selected.sessionName"> · {{ selected.sessionName }}</template>
            <template v-if="selected.className"> · {{ selected.className }}</template>
          </span>
        </div>

        <!-- Workflow actions -->
        <div class="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
          <button
            v-if="canReview && DECIDABLE.includes(selected.status)"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            @click="markReviewed"
          >
            Mark reviewed
          </button>
          <button
            v-if="canApprove && DECIDABLE.includes(selected.status)"
            class="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            @click="approve"
          >
            Accept
          </button>
          <button
            v-if="canReject && DECIDABLE.includes(selected.status)"
            class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            @click="reject"
          >
            Reject
          </button>
          <button
            v-if="canReview && ['applied','documents_submitted','under_review','assessment_scheduled','assessed'].includes(selected.status)"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            @click="waitlist"
          >
            Waitlist
          </button>
          <button
            v-if="canApprove && ['accepted','waitlisted'].includes(selected.status)"
            class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openEnroll"
          >
            Enroll student
          </button>
          <button
            v-if="canUpdate && OPEN.includes(selected.status)"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            @click="withdraw"
          >
            Withdraw
          </button>
        </div>

        <!-- Applicant + guardian -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Applicant</h3>
            <dl class="space-y-1 text-gray-700">
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Other names</dt><dd>{{ selected.otherNames || '—' }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Date of birth</dt><dd>{{ fmtDate(selected.dateOfBirth) }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Gender</dt><dd>{{ selected.gender || '—' }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Nationality</dt><dd>{{ selected.nationality || '—' }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Previous school</dt><dd>{{ selected.previousSchool || '—' }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Address</dt><dd class="text-right">{{ selected.address || '—' }}</dd></div>
            </dl>
          </div>
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Guardian</h3>
            <dl class="space-y-1 text-gray-700">
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Name</dt><dd>{{ selected.guardianName || '—' }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Phone</dt><dd>{{ selected.guardianPhone || '—' }}</dd></div>
              <div class="flex justify-between gap-2"><dt class="text-gray-400">Email</dt><dd>{{ selected.guardianEmail || '—' }}</dd></div>
            </dl>
            <dl class="mt-4 space-y-1 text-xs text-gray-400">
              <div>Reviewed: {{ fmtDateTime(selected.reviewedAt) }}</div>
              <div>Decided: {{ fmtDateTime(selected.decidedAt) }}</div>
            </dl>
          </div>
        </div>

        <p v-if="selected.decisionNotes" class="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
          <span class="font-medium text-gray-700">Decision notes:</span>
          {{ selected.decisionNotes }}
        </p>

        <!-- Documents -->
        <section>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Documents ({{ selected.documents.length }})
            </h3>
          </div>
          <ul v-if="selected.documents.length" class="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
            <li
              v-for="doc in selected.documents"
              :key="doc.id"
              class="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div>
                <p class="font-medium text-gray-800">{{ doc.documentType }}</p>
                <p class="text-xs text-gray-400">
                  {{ doc.fileName }}<template v-if="doc.sizeBytes"> · {{ fmtBytes(doc.sizeBytes) }}</template> · {{ fmtDate(doc.uploadedAt) }}
                </p>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <a
                  v-if="canViewDocs"
                  :href="admissionsApi.documentUrl(selected.id, doc.id)"
                  target="_blank"
                  class="font-medium text-indigo-700 hover:underline"
                >
                  Download
                </a>
                <button
                  v-if="canManageDocs"
                  class="text-red-700 hover:underline"
                  @click="removeDocument(doc.id, doc.fileName)"
                >
                  Delete
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">No documents uploaded yet.</p>

          <div v-if="canManageDocs && OPEN.includes(selected.status)" class="mt-3 flex flex-wrap items-end gap-3">
            <label class="text-sm">
              <span class="block text-xs font-medium text-gray-500">Type</span>
              <select v-model="uploadType" class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                <option v-for="t in DOCUMENT_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
            <input
              type="file"
              class="text-sm"
              @change="onFileChange"
            />
            <button
              :disabled="uploading"
              class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              @click="submitUpload"
            >
              {{ uploading ? 'Uploading…' : 'Upload' }}
            </button>
            <p v-if="uploadError" class="w-full text-sm text-red-700">{{ uploadError }}</p>
            <p class="w-full text-xs text-gray-400">
              PDF, images, Office documents, text or ZIP · up to 10 MB.
            </p>
          </div>
        </section>

        <!-- Assessments -->
        <section>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Assessments / interviews ({{ selected.assessments.length }})
            </h3>
            <button
              v-if="canUpdate && OPEN.includes(selected.status)"
              class="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              @click="openAddAssessment"
            >
              Add assessment
            </button>
          </div>
          <ul v-if="selected.assessments.length" class="space-y-2">
            <li
              v-for="a in selected.assessments"
              :key="a.id"
              class="rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-medium text-gray-800">
                  {{ a.title }}
                  <span class="ml-1 text-xs font-normal text-gray-400">
                    {{ ASSESSMENT_TYPES.find((t) => t.value === a.assessmentType)?.label ?? 'Assessment' }}
                  </span>
                </p>
                <div v-if="canUpdate && OPEN.includes(selected.status)" class="flex gap-3 text-xs">
                  <button class="text-gray-600 hover:underline" @click="openEditAssessment(a)">Edit</button>
                  <button class="text-red-700 hover:underline" @click="removeAssessment(a)">Delete</button>
                </div>
              </div>
              <p class="mt-1 text-xs text-gray-500">
                Scheduled: {{ a.scheduledAt ? fmtDateTime(a.scheduledAt) : '—' }}
                <template v-if="a.score"> · Score: {{ a.score }}</template>
                <template v-if="a.result">
                  · Result: {{ ASSESSMENT_RESULTS.find((r) => r.value === a.result)?.label ?? a.result }}
                </template>
              </p>
              <p v-if="a.notes" class="mt-1 text-xs text-gray-500">{{ a.notes }}</p>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">No assessments scheduled.</p>
        </section>
      </div>
    </BaseModal>

    <!-- Assessment form -->
    <BaseModal
      :open="assessmentModalOpen"
      :title="editingAssessmentId ? 'Edit assessment' : 'Add assessment / interview'"
      @close="assessmentModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitAssessment">
        <p v-if="assessmentError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ assessmentError }}</p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Title *</span>
          <input v-model="assessmentForm.title" required maxlength="150" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Type</span>
            <select v-model="assessmentForm.assessmentType" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option v-for="t in ASSESSMENT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Scheduled at</span>
            <input v-model="assessmentForm.scheduledAt" type="datetime-local" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Score</span>
            <input v-model="assessmentForm.score" maxlength="50" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Result</span>
            <select v-model="assessmentForm.result" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Pending</option>
              <option v-for="r in ASSESSMENT_RESULTS" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </label>
        </div>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Notes</span>
          <textarea v-model="assessmentForm.notes" rows="3" maxlength="2000" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" @click="assessmentModalOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="assessmentSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ assessmentSaving ? 'Saving…' : 'Save assessment' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Enroll conversion -->
    <BaseModal
      :open="enrollModalOpen"
      title="Convert to enrolled student"
      @close="enrollModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitEnroll">
        <p v-if="enrollError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ enrollError }}</p>
        <p class="text-sm text-gray-500">
          This creates the student record, an active enrollment and — optionally — a guardian
          parent record in one transaction.
        </p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Admission number *</span>
          <input v-model="enrollForm.admissionNumber" required maxlength="50" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Session *</span>
            <select v-model="enrollForm.sessionId" required class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Class *</span>
            <select v-model="enrollForm.classId" required class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Section</span>
            <select v-model="enrollForm.sectionId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">None</option>
              <option v-for="s in enrollSections" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Term</span>
            <select v-model="enrollForm.termId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">None</option>
              <option v-for="t in enrollTerms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Roll number</span>
            <input v-model="enrollForm.rollNumber" maxlength="50" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Enrollment date *</span>
            <input v-model="enrollForm.enrollmentDate" type="date" required class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
        </div>
        <label v-if="selected?.guardianName" class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="enrollForm.createGuardianParent" type="checkbox" />
          Create a guardian parent record for {{ selected.guardianName }} and link the student
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" @click="enrollModalOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="enrollSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ enrollSaving ? 'Enrolling…' : 'Enroll student' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
