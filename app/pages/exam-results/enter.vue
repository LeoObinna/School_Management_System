<script setup lang="ts">
/**
 * Teacher self-service: score entry (Phase 7 Option B).
 *
 * Replaces the stub grid in /exams.vue with a class-roster-driven
 * score-entry page. Two modes share the same layout:
 *
 *   - 'ca'   continuous assessment via /assessment-scores/bulk
 *   - 'exam' exam scores via /exams/:id/scores
 *
 * The teacher's class assignments (resolved server-side via
 * /teacher-assignments/me) drive the class and subject dropdowns; the
 * roster comes from /teachers/me/students (also server-side scoped to
 * the caller). Existing CA scores are pre-loaded via
 * /assessment-scores so the grid shows what's already recorded; exam
 * scores are not pre-loaded because no public list endpoint exists —
 * the bulk upsert is idempotent via onConflictDoUpdate, so re-entering
 * overwrites cleanly.
 *
 * Backend authorization (assertCanEnterForStudent + publication lock
 * via assertScoresUnlocked) is enforced in exams.ts; this page never
 * trusts client-only checks.
 */
import { academicsApi } from '~/services/academics'
import { examsApi } from '~/services/exams'
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  AssessmentScoreDetail,
  AssessmentType,
  ExamDetail,
  ExamListItem,
  TeacherClassAssignmentDetail,
  TeacherStudentRow,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['exam_results.enter'] })

useHead({ title: 'Enter Scores — Teacher' })

type Mode = 'ca' | 'exam'

const mode = ref<Mode>('ca')
const loading = ref(true)
const loadError = ref<string | null>(null)

const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const myClasses = ref<TeacherClassAssignmentDetail[]>([])
const assessmentTypes = ref<AssessmentType[]>([])
const examList = ref<ExamListItem[]>([])
const examDetail = ref<ExamDetail | null>(null)

const filters = reactive({
  sessionId: '',
  termId: '',
  classId: '',
  subjectId: '',
  assessmentTypeId: '',
  maxScore: '100',
  examId: '',
  examSubjectId: '',
})

const roster = ref<TeacherStudentRow[]>([])
const existingScores = ref<AssessmentScoreDetail[]>([])
const scoreRows = ref<{ studentId: string; admissionNumber: string; name: string; score: string }[]>([])
const busy = ref(false)
const formError = ref<string | null>(null)
const formOk = ref<string | null>(null)

// --- Filtered option lists ----------------------------------------------
const classOptions = computed(() => {
  // Distinct classes from my teacher_class_assignments for the picked session
  const seen = new Set<string>()
  const out: { classId: string; className: string; sectionName: string | null }[] = []
  for (const row of myClasses.value) {
    if (filters.sessionId && row.sessionId !== filters.sessionId) continue
    if (seen.has(row.classId)) continue
    seen.add(row.classId)
    out.push({
      classId: row.classId,
      className: row.className,
      sectionName: row.sectionName,
    })
  }
  return out
})

const subjectOptions = computed(() => {
  // Subjects the teacher is assigned to teach for the picked class+session
  const seen = new Set<string>()
  const out: { subjectId: string; subjectName: string }[] = []
  for (const row of myClasses.value) {
    if (row.classId !== filters.classId) continue
    if (filters.sessionId && row.sessionId !== filters.sessionId) continue
    if (seen.has(row.subjectId)) continue
    seen.add(row.subjectId)
    out.push({ subjectId: row.subjectId, subjectName: row.subjectName })
  }
  return out
})

const examOptions = computed(() =>
  examList.value.filter(
    (e) =>
      (!filters.sessionId || e.sessionId === filters.sessionId) &&
      (!filters.classId || e.classId === filters.classId),
  ),
)

const examSubjectOptions = computed(() => examDetail.value?.subjects ?? [])

const activeAssessmentTypes = computed(() =>
  assessmentTypes.value.filter((t) => t.isActive),
)

// --- Initial load -------------------------------------------------------
async function loadBase() {
  loading.value = true
  loadError.value = null
  try {
    const [sessPage, classPage, typesPage] = await Promise.all([
      academicsApi.listSessions({ perPage: 100 }),
      teachersApi.listMyClasses(),
      examsApi.listAssessmentTypes({ perPage: 100 }),
    ])
    sessions.value = sessPage.data
    myClasses.value = classPage.data
    assessmentTypes.value = typesPage.data
    const current =
      sessions.value.find((s) => s.isCurrent) ?? sessions.value[0]
    if (current) {
      filters.sessionId = current.id
      await loadTerms(current.id)
      const term =
        terms.value.find((t) => t.isCurrent) ?? terms.value[0]
      if (term) filters.termId = term.id
    }
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
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
  } catch (e) {
    terms.value = []
    loadError.value = formatApiError(e)
  }
}

async function loadExamsForClass() {
  examList.value = []
  examDetail.value = null
  filters.examId = ''
  filters.examSubjectId = ''
  if (!filters.sessionId || !filters.classId) return
  try {
    const res = await examsApi.listExams({
      sessionId: filters.sessionId,
      classId: filters.classId,
    })
    examList.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function loadExamDetail() {
  examDetail.value = null
  filters.examSubjectId = ''
  if (!filters.examId) return
  try {
    examDetail.value = await examsApi.getExam(filters.examId)
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// --- Roster + score grid -----------------------------------------------
async function loadRoster() {
  roster.value = []
  scoreRows.value = []
  existingScores.value = []
  if (!filters.classId) return
  try {
    const res = await teachersApi.listMyStudents({
      page: 1,
      perPage: 100,
      order: 'asc',
      classId: filters.classId,
    })
    roster.value = res.data
    scoreRows.value = res.data.map((s) => ({
      studentId: s.id,
      admissionNumber: s.admissionNumber,
      name: `${s.firstName} ${s.lastName}`.trim(),
      score: '',
    }))
    if (mode.value === 'ca') await loadExistingCaScores()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

async function loadExistingCaScores() {
  if (
    !filters.sessionId ||
    !filters.subjectId ||
    !filters.assessmentTypeId
  ) {
    return
  }
  try {
    const res = await examsApi.listAssessmentScores({
      sessionId: filters.sessionId,
      termId: filters.termId || undefined,
      subjectId: filters.subjectId,
      assessmentTypeId: filters.assessmentTypeId,
      perPage: 100,
    })
    existingScores.value = res.data
    const byStudent = new Map(
      res.data.map((r) => [r.studentId, r.score]),
    )
    for (const row of scoreRows.value) {
      const existing = byStudent.get(row.studentId)
      if (existing !== undefined) row.score = existing
    }
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// --- React to filter changes -------------------------------------------
watch(
  () => filters.sessionId,
  async (id) => {
    await loadTerms(id)
    filters.termId =
      terms.value.find((t) => t.isCurrent)?.id ?? terms.value[0]?.id ?? ''
    await loadExamsForClass()
  },
)

watch(
  () => filters.classId,
  async () => {
    formError.value = null
    formOk.value = null
    await loadExamsForClass()
    await loadRoster()
  },
)

watch(
  () => [
    filters.sessionId,
    filters.termId,
    filters.subjectId,
    filters.assessmentTypeId,
  ],
  async () => {
    formError.value = null
    formOk.value = null
    if (mode.value === 'ca') await loadExistingCaScores()
  },
)

watch(
  () => filters.examId,
  async () => {
    formError.value = null
    formOk.value = null
    await loadExamDetail()
  },
)

watch(
  () => filters.examSubjectId,
  () => {
    formError.value = null
    formOk.value = null
  },
)

watch(mode, () => {
  formError.value = null
  formOk.value = null
})

onMounted(loadBase)

// --- Save --------------------------------------------------------------
const canSaveCa = computed(
  () =>
    !!(
      filters.sessionId &&
      filters.subjectId &&
      filters.assessmentTypeId &&
      filters.maxScore &&
      scoreRows.value.some((r) => r.score !== '')
    ),
)

const canSaveExam = computed(
  () =>
    !!(
      filters.examId &&
      filters.examSubjectId &&
      scoreRows.value.some((r) => r.score !== '')
    ),
)

const maxScoreLabel = computed(() => {
  if (mode.value === 'ca') return filters.maxScore || '100'
  const subj = examSubjectOptions.value.find(
    (s) => s.id === filters.examSubjectId,
  )
  return subj?.maxScore ?? '100'
})

async function saveCa() {
  if (!canSaveCa.value) return
  busy.value = true
  formError.value = null
  formOk.value = null
  try {
    const scores = scoreRows.value
      .filter((r) => r.score !== '')
      .map((r) => ({ studentId: r.studentId, score: r.score }))
    const res = await examsApi.bulkUpsertAssessmentScores({
      subjectId: filters.subjectId,
      sessionId: filters.sessionId,
      termId: filters.termId || null,
      assessmentTypeId: filters.assessmentTypeId,
      maxScore: filters.maxScore,
      scores,
    })
    formOk.value = `Saved ${res.count} score${res.count === 1 ? '' : 's'}.`
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}

async function saveExam() {
  if (!canSaveExam.value || !filters.examId) return
  busy.value = true
  formError.value = null
  formOk.value = null
  try {
    const scores = scoreRows.value
      .filter((r) => r.score !== '')
      .map((r) => ({ studentId: r.studentId, score: r.score }))
    const res = await examsApi.bulkUpsertExamScores(filters.examId, {
      examSubjectId: filters.examSubjectId,
      scores,
    })
    formOk.value = `Saved ${res.count} score${res.count === 1 ? '' : 's'}.`
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}

function setMode(next: Mode) {
  mode.value = next
}

function clearScores() {
  for (const row of scoreRows.value) row.score = ''
  formOk.value = null
  formError.value = null
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">Enter Scores</h1>
      <p class="mt-1 text-sm text-gray-500">
        Continuous assessment and exam scores for the classes you teach.
      </p>
    </div>

    <!-- Mode toggle -->
    <div class="inline-flex rounded-md border border-gray-200 overflow-hidden">
      <button
        class="px-4 py-2 text-sm font-medium"
        :class="mode === 'ca' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
        @click="setMode('ca')"
      >
        Continuous assessment
      </button>
      <button
        class="px-4 py-2 text-sm font-medium border-l border-gray-200"
        :class="mode === 'exam' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
        @click="setMode('exam')"
      >
        Exam
      </button>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>

    <div v-else class="space-y-4">
      <!-- Shared filters -->
      <div class="bg-white rounded-lg shadow p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label class="block text-sm">
          <span class="text-gray-700">Session</span>
          <select v-model="filters.sessionId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select session</option>
            <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Term</span>
          <select v-model="filters.termId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">No term</option>
            <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Class</span>
          <select v-model="filters.classId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select class</option>
            <option v-for="c in classOptions" :key="c.classId" :value="c.classId">
              {{ c.className }}<span v-if="c.sectionName"> — {{ c.sectionName }}</span>
            </option>
          </select>
        </label>
      </div>

      <!-- CA filters -->
      <div v-if="mode === 'ca'" class="bg-white rounded-lg shadow p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label class="block text-sm">
          <span class="text-gray-700">Subject</span>
          <select v-model="filters.subjectId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select subject</option>
            <option v-for="s in subjectOptions" :key="s.subjectId" :value="s.subjectId">{{ s.subjectName }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Assessment type</span>
          <select v-model="filters.assessmentTypeId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select assessment type</option>
            <option v-for="t in activeAssessmentTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Max score</span>
          <input
            v-model="filters.maxScore"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="100"
          />
        </label>
      </div>

      <!-- Exam filters -->
      <div v-else class="bg-white rounded-lg shadow p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="block text-sm">
          <span class="text-gray-700">Exam</span>
          <select v-model="filters.examId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select exam</option>
            <option v-for="e in examOptions" :key="e.id" :value="e.id">
              {{ e.name }}<span class="text-gray-500"> · {{ e.subjectCount }} subject(s)</span>
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Exam subject</span>
          <select v-model="filters.examSubjectId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" :disabled="!examSubjectOptions.length">
            <option value="">Select exam subject</option>
            <option v-for="s in examSubjectOptions" :key="s.id" :value="s.id">
              {{ s.subjectName }}<span class="text-gray-500"> / max {{ s.maxScore }}</span>
            </option>
          </select>
        </label>
      </div>

      <!-- Score grid -->
      <section v-if="filters.classId && roster.length" class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-medium text-gray-900">
            Scores
            <span class="text-xs text-gray-500">/ max {{ maxScoreLabel }}</span>
          </h2>
          <button class="text-xs text-gray-600 hover:underline" @click="clearScores">Clear all</button>
        </div>
        <p v-if="formOk" class="mb-3 text-sm text-green-700">{{ formOk }}</p>
        <p v-if="formError" class="mb-3 text-sm text-red-700">{{ formError }}</p>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Adm no</th>
                <th class="px-3 py-2 text-left font-medium">Student</th>
                <th class="px-3 py-2 text-left font-medium">Score</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="row in scoreRows" :key="row.studentId">
                <td class="px-3 py-2 text-gray-700">{{ row.admissionNumber }}</td>
                <td class="px-3 py-2 text-gray-900">{{ row.name }}</td>
                <td class="px-3 py-2">
                  <input
                    v-model="row.score"
                    placeholder="—"
                    class="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end">
          <button
            v-if="mode === 'ca'"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="busy || !canSaveCa"
            @click="saveCa"
          >
            {{ busy ? 'Saving…' : 'Save scores' }}
          </button>
          <button
            v-else
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="busy || !canSaveExam"
            @click="saveExam"
          >
            {{ busy ? 'Saving…' : 'Save scores' }}
          </button>
        </div>
      </section>

      <div
        v-else-if="filters.classId && !roster.length"
        class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500"
      >
        No active students enrolled in this class for the selected session.
      </div>

      <div
        v-else-if="mode === 'ca' && !filters.classId"
        class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500"
      >
        Pick a class, subject and assessment type to begin.
      </div>
      <div
        v-else-if="mode === 'exam' && !filters.classId"
        class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500"
      >
        Pick a class and exam to begin.
      </div>
    </div>
  </div>
</template>
