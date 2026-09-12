<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { assignmentsApi } from '~/services/assignments'
import { formatApiError } from '~/utils/errors'
import { PUBLICATION_STATUSES } from '~/shared/schemas'
import type {
  AcademicSession,
  AssignmentDetail,
  AssignmentListItem,
  AssignmentSubmission,
  SchoolClass,
  Section,
  Subject,
  SubmissionDetail,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['assignments.view'] })

const auth = useAuthStore()
const isStaff = computed(() => auth.can('assignments.create'))
const canGrade = computed(() => auth.can('submissions.grade'))

// --- Reference data --------------------------------------------------------
const loading = ref(false)
const loadError = ref<string | null>(null)
const assignments = ref<AssignmentListItem[]>([])
const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const classes = ref<SchoolClass[]>([])
const sections = ref<Section[]>([])
const subjects = ref<Subject[]>([])

const filters = reactive({ sessionId: '', classId: '', status: '' })
const currentSessionId = ref('')

async function loadBase() {
  const [sessPage, classPage, sectionPage, subjectPage] = await Promise.all([
    academicsApi.listSessions({ perPage: 100 }),
    academicsApi.listClasses({ perPage: 100, isActive: true }),
    academicsApi.listSections({ perPage: 300 }),
    academicsApi.listSubjects({ perPage: 200, isActive: true }),
  ])
  sessions.value = sessPage.data
  classes.value = classPage.data
  sections.value = sectionPage.data
  subjects.value = subjectPage.data
  currentSessionId.value =
    sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
  filters.sessionId = currentSessionId.value
  await loadAssignments()
}

async function loadTerms(sessionId: string) {
  if (!sessionId) {
    terms.value = []
    return
  }
  const page = await academicsApi.listTerms({ sessionId, perPage: 50 })
  terms.value = page.data
}

async function loadAssignments() {
  loading.value = true
  loadError.value = null
  try {
    const res = isStaff.value
      ? await assignmentsApi.list({
          sessionId: filters.sessionId || undefined,
          classId: filters.classId || undefined,
          status: (filters.status || undefined) as never,
        })
      : await assignmentsApi.listMyAssignments({
          sessionId: filters.sessionId || undefined,
        })
    assignments.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => filters.sessionId,
  async (id) => {
    await loadTerms(id)
    await loadAssignments()
  },
)
watch(
  () => [filters.classId, filters.status],
  async () => {
    if (isStaff.value) {
      await loadAssignments()
    }
  },
)

onMounted(loadBase)

// --- Shared helpers --------------------------------------------------------
function subjectName(id: string) {
  return subjects.value.find((s) => s.id === id)?.name ?? '—'
}
function className(id: string) {
  return classes.value.find((c) => c.id === id)?.name ?? '—'
}
function formatDue(value: string | null) {
  if (!value) {
    return 'No due date'
  }
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
function isOverdue(a: AssignmentListItem) {
  return Boolean(
    a.dueDate &&
      a.mySubmission &&
      (a.mySubmission.status === 'draft') &&
      new Date(a.dueDate).getTime() < Date.now(),
  )
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-200 text-gray-600',
  submitted: 'bg-blue-100 text-blue-800',
  late: 'bg-amber-100 text-amber-800',
  graded: 'bg-green-100 text-green-700',
  returned: 'bg-purple-100 text-purple-800',
}

// --- Staff: create / edit --------------------------------------------------
const editOpen = ref(false)
const editing = ref<AssignmentListItem | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  sessionId: '',
  termId: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  title: '',
  instructions: '',
  maxScore: 100,
  dueLocal: '',
  status: 'draft' as (typeof PUBLICATION_STATUSES)[number],
})

const sectionsForClass = computed(() =>
  sections.value.filter((s) => s.classId === form.classId),
)

watch(
  () => form.classId,
  () => {
    // Keep the section only when it still belongs to the class.
    if (form.sectionId && !sectionsForClass.value.some((s) => s.id === form.sectionId)) {
      form.sectionId = ''
    }
  },
)

function openCreate() {
  editing.value = null
  Object.assign(form, {
    sessionId: currentSessionId.value,
    termId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    title: '',
    instructions: '',
    maxScore: 100,
    dueLocal: '',
    status: 'draft',
  })
  formError.value = null
  editOpen.value = true
}

function openEdit(a: AssignmentListItem) {
  editing.value = a
  Object.assign(form, {
    sessionId: a.sessionId,
    termId: a.termId ?? '',
    classId: a.classId,
    sectionId: a.sectionId ?? '',
    subjectId: a.subjectId,
    title: a.title,
    instructions: a.instructions ?? '',
    maxScore: a.maxScore,
    dueLocal: a.dueDate ? a.dueDate.slice(0, 16) : '',
    status: a.status,
  })
  formError.value = null
  editOpen.value = true
}

async function submitForm() {
  saving.value = true
  formError.value = null
  const payload = {
    sessionId: form.sessionId,
    termId: form.termId || null,
    classId: form.classId,
    sectionId: form.sectionId || null,
    subjectId: form.subjectId,
    title: form.title.trim(),
    instructions: form.instructions.trim() || null,
    maxScore: form.maxScore,
    dueDate: form.dueLocal ? new Date(form.dueLocal).toISOString() : null,
    status: form.status,
  }
  try {
    if (editing.value) {
      await assignmentsApi.update(editing.value.id, payload)
    } else {
      await assignmentsApi.create(payload)
    }
    editOpen.value = false
    await loadAssignments()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function removeAssignment(a: AssignmentListItem) {
  if (!confirm(`Delete "${a.title}"? Attachments and submissions will also be removed.`)) {
    return
  }
  try {
    await assignmentsApi.remove(a.id)
    await loadAssignments()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// --- Staff: manage attachments + submissions --------------------------------
const manageOpen = ref(false)
const managing = ref<AssignmentDetail | null>(null)
const submissions = ref<SubmissionDetail[]>([])
const manageError = ref<string | null>(null)
const attachmentFile = ref<File | null>(null)
const uploading = ref(false)

async function openManage(a: AssignmentListItem) {
  manageError.value = null
  try {
    const [detail, subs] = await Promise.all([
      assignmentsApi.get(a.id),
      assignmentsApi.listSubmissions(a.id, { perPage: 100 }),
    ])
    managing.value = detail
    submissions.value = subs.data
    manageOpen.value = true
  } catch (e) {
    manageError.value = formatApiError(e)
  }
}

async function uploadAttachment() {
  if (!managing.value || !attachmentFile.value) {
    return
  }
  uploading.value = true
  manageError.value = null
  try {
    await assignmentsApi.uploadAttachment(managing.value.id, attachmentFile.value)
    attachmentFile.value = null
    managing.value = await assignmentsApi.get(managing.value.id)
  } catch (e) {
    manageError.value = formatApiError(e)
  } finally {
    uploading.value = false
  }
}

async function removeAttachment(attachmentId: string) {
  if (!managing.value || !confirm('Remove this attachment?')) {
    return
  }
  try {
    await assignmentsApi.removeAttachment(managing.value.id, attachmentId)
    managing.value = await assignmentsApi.get(managing.value.id)
  } catch (e) {
    manageError.value = formatApiError(e)
  }
}

const gradeDraft = reactive<Record<string, { score: string; feedback: string }>>({})

function startGrade(s: SubmissionDetail) {
  gradeDraft[s.id] = {
    score: s.score === null ? '' : String(s.score),
    feedback: s.feedback ?? '',
  }
}

function ensureGrade(s: SubmissionDetail) {
  if (!gradeDraft[s.id]) {
    startGrade(s)
  }
}

function setGradeScore(s: SubmissionDetail, value: string) {
  ensureGrade(s)
  gradeDraft[s.id]!.score = value
}

function setGradeFeedback(s: SubmissionDetail, value: string) {
  ensureGrade(s)
  gradeDraft[s.id]!.feedback = value
}

async function saveGrade(s: SubmissionDetail) {
  const draft = gradeDraft[s.id]
  if (!draft || !managing.value) {
    return
  }
  try {
    await assignmentsApi.gradeSubmission(
      managing.value.id,
      s.studentId,
      {
        score: Number(draft.score),
        feedback: draft.feedback.trim() || null,
      },
    )
    const subs = await assignmentsApi.listSubmissions(managing.value.id, { perPage: 100 })
    submissions.value = subs.data
  } catch (e) {
    manageError.value = formatApiError(e)
  }
}

// --- Student workspace -----------------------------------------------------
const workOpen = ref(false)
const workAssignment = ref<AssignmentListItem | null>(null)
const workDetail = ref<AssignmentDetail | null>(null)
const workSubmission = ref<AssignmentSubmission | null>(null)
const workText = ref('')
const workFile = ref<File | null>(null)
const workError = ref<string | null>(null)
const workBusy = ref(false)

async function openWork(a: AssignmentListItem) {
  workAssignment.value = a
  workDetail.value = null
  workError.value = null
  workFile.value = null
  try {
    const [detail, res] = await Promise.all([
      assignmentsApi.get(a.id),
      assignmentsApi.getMySubmission(a.id),
    ])
    workDetail.value = detail
    const sub = res && 'data' in res ? res.data : (res as AssignmentSubmission | null)
    workSubmission.value = sub
    workText.value = sub?.textContent ?? ''
    workOpen.value = true
  } catch (e) {
    workError.value = formatApiError(e)
  }
}

const locked = computed(
  () =>
    workSubmission.value?.status === 'graded' ||
    workSubmission.value?.status === 'returned',
)

async function saveDraft() {
  if (!workAssignment.value) {
    return
  }
  workBusy.value = true
  workError.value = null
  try {
    if (workFile.value) {
      workSubmission.value = await assignmentsApi.uploadSubmission(
        workAssignment.value.id,
        workFile.value,
        workText.value,
      )
    } else {
      workSubmission.value = await assignmentsApi.saveTextSubmission(
        workAssignment.value.id,
        { textContent: workText.value },
      )
    }
    workFile.value = null
    await loadAssignments()
  } catch (e) {
    workError.value = formatApiError(e)
  } finally {
    workBusy.value = false
  }
}

async function submitWork() {
  if (!workAssignment.value) {
    return
  }
  workBusy.value = true
  workError.value = null
  try {
    if (workFile.value) {
      await assignmentsApi.uploadSubmission(
        workAssignment.value.id,
        workFile.value,
        workText.value,
      )
    } else if (!workSubmission.value || workText.value !== (workSubmission.value.textContent ?? '')) {
      await assignmentsApi.saveTextSubmission(workAssignment.value.id, {
        textContent: workText.value,
      })
    }
    workSubmission.value = await assignmentsApi.submit(workAssignment.value.id)
    workOpen.value = false
    await loadAssignments()
  } catch (e) {
    workError.value = formatApiError(e)
  } finally {
    workBusy.value = false
  }
}

async function removeMyFile() {
  if (!workAssignment.value || !confirm('Remove your uploaded file?')) {
    return
  }
  try {
    workSubmission.value = await assignmentsApi.saveTextSubmission(
      workAssignment.value.id,
      { removeFile: true },
    )
  } catch (e) {
    workError.value = formatApiError(e)
  }
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) {
    return ''
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">
          {{ isStaff ? 'Assignments' : 'My Assignments' }}
        </h1>
        <p class="mt-1 text-sm text-gray-500">
          {{
            isStaff
              ? 'Set work, attach materials and grade submissions.'
              : 'Published work for your enrolled classes.'
          }}
        </p>
      </div>
      <button
        v-if="isStaff"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New assignment
      </button>
    </div>

    <div class="flex flex-wrap gap-3">
      <select v-model="filters.sessionId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">All sessions</option>
        <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <template v-if="isStaff">
        <select v-model="filters.classId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All classes</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="filters.status" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option v-for="s in PUBLICATION_STATUSES" :key="s" :value="s">
            {{ s.charAt(0).toUpperCase() + s.slice(1) }}
          </option>
        </select>
      </template>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ loadError }}</p>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>

    <div v-else-if="assignments.length === 0" class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
      No assignments found.
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="a in assignments"
        :key="a.id"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-medium text-gray-900">{{ a.title }}</h2>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_STYLES[a.status]"
              >
                {{ a.status }}
              </span>
              <span
                v-if="isStaff === false && a.mySubmission"
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_STYLES[a.mySubmission.status]"
              >
                {{ a.mySubmission.status }}
              </span>
            </div>
            <p class="mt-1 text-sm text-gray-500">
              {{ subjectName(a.subjectId) }} · {{ className(a.classId)
              }}<template v-if="a.sectionName"> · {{ a.sectionName }}</template>
              · {{ formatDue(a.dueDate) }}
            </p>
          </div>
          <div class="flex gap-2">
            <button
              v-if="isStaff"
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              @click="openManage(a)"
            >
              Manage
            </button>
            <button
              v-if="isStaff"
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              @click="openEdit(a)"
            >
              Edit
            </button>
            <button
              v-if="isStaff"
              class="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              @click="removeAssignment(a)"
            >
              Delete
            </button>
            <button
              v-else
              class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              @click="openWork(a)"
            >
              {{ a.mySubmission ? 'View / edit work' : 'Start work' }}
            </button>
          </div>
        </div>
        <p
          v-if="!isStaff && isOverdue(a)"
          class="mt-2 text-xs font-medium text-amber-700"
        >
          The due date has passed — submission will be marked late.
        </p>
      </article>
    </div>

    <!-- Staff: create / edit -->
    <BaseModal
      :open="editOpen"
      :title="editing ? 'Edit assignment' : 'New assignment'"
      @close="editOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitForm">
        <p v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Session</span>
            <select v-model="form.sessionId" required class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Term (optional)</span>
            <select v-model="form.termId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Whole session</option>
              <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Class</span>
            <select v-model="form.classId" required class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="" disabled>Select class</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Section (optional)</span>
            <select v-model="form.sectionId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Whole class</option>
              <option v-for="s in sectionsForClass" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Subject</span>
            <select v-model="form.subjectId" required class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="" disabled>Select subject</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Maximum score</span>
            <input v-model.number="form.maxScore" type="number" min="1" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
        </div>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Title</span>
          <input v-model="form.title" required maxlength="255" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Instructions</span>
          <textarea v-model="form.instructions" rows="4" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Due date</span>
            <input v-model="form.dueLocal" type="datetime-local" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Status</span>
            <select v-model="form.status" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option v-for="s in PUBLICATION_STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" @click="editOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ saving ? 'Saving…' : 'Save assignment' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Staff: attachments + grading -->
    <BaseModal
      :open="manageOpen"
      :title="managing ? managing.title : 'Manage assignment'"
      wide
      @close="manageOpen = false"
    >
      <div v-if="manageError" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ manageError }}</div>
      <template v-if="managing">
        <section class="mb-6">
          <h3 class="text-sm font-semibold text-gray-900">Attachments</h3>
          <ul v-if="managing.attachments.length" class="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
            <li
              v-for="att in managing.attachments"
              :key="att.id"
              class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <a
                :href="assignmentsApi.attachmentUrl(managing.id, att.id)"
                target="_blank"
                class="text-indigo-700 hover:underline"
              >
                {{ att.fileName }}
                <span class="text-xs text-gray-400">({{ formatBytes(att.sizeBytes) }})</span>
              </a>
              <button
                class="text-xs text-red-700 hover:underline"
                @click="removeAttachment(att.id)"
              >
                Remove
              </button>
            </li>
          </ul>
          <p v-else class="mt-2 text-sm text-gray-500">No attachments yet.</p>
          <div class="mt-3 flex items-center gap-2">
            <input
              ref="attachmentInput"
              type="file"
              class="text-sm"
              @change="attachmentFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
            />
            <button
              :disabled="!attachmentFile || uploading"
              class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              @click="uploadAttachment"
            >
              {{ uploading ? 'Uploading…' : 'Upload' }}
            </button>
          </div>
        </section>

        <section>
          <h3 class="text-sm font-semibold text-gray-900">
            Submissions ({{ submissions.length }})
          </h3>
          <div v-if="submissions.length === 0" class="mt-2 text-sm text-gray-500">
            No submissions yet.
          </div>
          <ul v-else class="mt-2 space-y-3">
            <li
              v-for="s in submissions"
              :key="s.id"
              class="rounded-md border border-gray-200 p-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {{ s.studentName }}
                    <span class="text-xs text-gray-400">{{ s.admissionNumber }}</span>
                  </p>
                  <p class="text-xs text-gray-500">
                    <span class="rounded-full px-2 py-0.5 font-medium" :class="STATUS_STYLES[s.status]">{{ s.status }}</span>
                    <template v-if="s.submittedAt"> · {{ formatDue(s.submittedAt) }}</template>
                  </p>
                </div>
                <a
                  v-if="s.objectKey"
                  :href="assignmentsApi.submissionFileUrl(managing.id, s.studentId)"
                  target="_blank"
                  class="text-sm text-indigo-700 hover:underline"
                >
                  Download {{ s.fileName }}
                </a>
              </div>
              <p v-if="s.textContent" class="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm text-gray-700">{{ s.textContent }}</p>
              <div v-if="canGrade" class="mt-3 grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-2">
                <input
                  :value="gradeDraft[s.id]?.score ?? (s.score ?? '')"
                  type="number"
                  min="0"
                  :max="s.maxScore"
                  :placeholder="`/${s.maxScore}`"
                  class="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  @input="setGradeScore(s, ($event.target as HTMLInputElement).value)"
                  @focus="ensureGrade(s)"
                />
                <input
                  :value="gradeDraft[s.id]?.feedback ?? s.feedback ?? ''"
                  placeholder="Feedback (optional)"
                  class="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  @input="setGradeFeedback(s, ($event.target as HTMLInputElement).value)"
                  @focus="ensureGrade(s)"
                />
                <button
                  class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  @click="saveGrade(s)"
                >
                  Save grade
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </BaseModal>

    <!-- Student: workspace -->
    <BaseModal
      :open="workOpen"
      :title="workAssignment ? workAssignment.title : 'Your work'"
      wide
      @close="workOpen = false"
    >
      <div v-if="workError" class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ workError }}</div>
      <template v-if="workAssignment">
        <p class="text-sm text-gray-600">
          {{ subjectName(workAssignment.subjectId) }} · Due {{ formatDue(workAssignment.dueDate) }}
        </p>
        <p v-if="workAssignment.instructions" class="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          {{ workAssignment.instructions }}
        </p>

        <section v-if="workDetail?.attachments?.length" class="mt-4">
          <h3 class="text-sm font-semibold text-gray-900">Materials</h3>
          <ul class="mt-1 space-y-1 text-sm">
            <li v-for="att in workDetail.attachments" :key="att.id">
              <a
                :href="assignmentsApi.attachmentUrl(workAssignment.id, att.id)"
                target="_blank"
                class="text-indigo-700 hover:underline"
              >
                {{ att.fileName }}
              </a>
            </li>
          </ul>
        </section>

        <div v-if="locked" class="mt-4 rounded-md bg-green-50 p-3">
          <p class="text-sm font-medium text-green-800">
            Graded: {{ workSubmission?.score }}/{{ workAssignment.maxScore }}
          </p>
          <p v-if="workSubmission?.feedback" class="mt-1 whitespace-pre-wrap text-sm text-green-800">
            {{ workSubmission.feedback }}
          </p>
        </div>

        <template v-else>
          <label class="mt-4 block text-sm">
            <span class="block font-medium text-gray-700">Written work</span>
            <textarea
              v-model="workText"
              rows="6"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <div class="mt-3">
            <p class="text-sm font-medium text-gray-700">File</p>
            <p v-if="workSubmission?.fileName && !workFile" class="mt-1 flex items-center gap-3 text-sm text-gray-600">
              <a
                :href="assignmentsApi.mySubmissionFileUrl(workAssignment.id)"
                target="_blank"
                class="text-indigo-700 hover:underline"
              >
                {{ workSubmission.fileName }}
              </a>
              <button class="text-xs text-red-700 hover:underline" @click="removeMyFile">Remove</button>
            </p>
            <input
              v-else
              type="file"
              class="mt-1 text-sm"
              @change="workFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
            />
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button
              :disabled="workBusy"
              class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
              @click="saveDraft"
            >
              {{ workBusy ? 'Saving…' : 'Save draft' }}
            </button>
            <button
              :disabled="workBusy"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              @click="submitWork"
            >
              Submit
            </button>
          </div>
        </template>
      </template>
    </BaseModal>
  </div>
</template>
