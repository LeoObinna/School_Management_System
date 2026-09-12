<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { peopleApi } from '~/services/people'
import { academicsApi } from '~/services/academics'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  SchoolClass,
  Section,
  Student,
  StudentEnrollmentDetail,
  Term,
} from '~/shared/types'

definePageMeta({ permissions: ['enrollments.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('enrollments.create'))
const canUpdate = computed(() => auth.can('enrollments.update'))

const loading = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<StudentEnrollmentDetail[]>([])

const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const classes = ref<SchoolClass[]>([])
const students = ref<Student[]>([])
const classSections = ref<Section[]>([])

const sessionFilter = ref('')
const classFilter = ref('')

const modalOpen = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  studentId: '',
  sessionId: '',
  termId: '',
  classId: '',
  sectionId: '',
  rollNumber: '',
  enrollmentDate: '',
  status: 'active',
  notes: '',
})

async function loadLists() {
  loading.value = true
  loadError.value = null
  try {
    const [sessPage, studentsRes, classPage] = await Promise.all([
      academicsApi.listSessions({ perPage: 100 }),
      peopleApi.listStudents({ perPage: 500 }),
      academicsApi.listClasses({ perPage: 100, isActive: true }),
    ])
    sessions.value = sessPage.data
    students.value = studentsRes.data
    classes.value = classPage.data
    sessionFilter.value = sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
    await loadEnrollments()
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function loadEnrollments() {
  if (!sessionFilter.value) {
    rows.value = []
    return
  }
  try {
    const res = await peopleApi.listEnrollments({
      sessionId: sessionFilter.value,
      ...(classFilter.value ? { classId: classFilter.value } : {}),
    })
    rows.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

function openCreate() {
  formError.value = null
  classSections.value = []
  Object.assign(form, {
    studentId: students.value[0]?.id ?? '',
    sessionId: sessionFilter.value || sessions.value[0]?.id || '',
    termId: '',
    classId: '',
    sectionId: '',
    rollNumber: '',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    status: 'active',
    notes: '',
  })
  modalOpen.value = true
}

watch(
  () => form.sessionId,
  async (id) => {
    terms.value = []
    form.termId = ''
    if (!id) {
      return
    }
    try {
      const page = await academicsApi.listTerms({ sessionId: id, perPage: 50 })
      terms.value = page.data
    } catch {
      /* optional */
    }
  },
)

watch(
  () => form.classId,
  async (id) => {
    form.sectionId = ''
    classSections.value = []
    if (!id) {
      return
    }
    try {
      const detail = await academicsApi.getClass(id)
      classSections.value = detail.sections
    } catch {
      /* optional */
    }
  },
)

async function submit() {
  saving.value = true
  formError.value = null
  try {
    const body = {
      studentId: form.studentId,
      sessionId: form.sessionId,
      classId: form.classId,
      enrollmentDate: form.enrollmentDate,
      status: form.status as 'active' | 'completed' | 'promoted' | 'repeated' | 'withdrawn',
      ...(form.termId ? { termId: form.termId } : {}),
      ...(form.sectionId ? { sectionId: form.sectionId } : {}),
      ...(form.rollNumber ? { rollNumber: form.rollNumber } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    }
    await peopleApi.createEnrollment(body)
    modalOpen.value = false
    await loadEnrollments()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function remove(row: StudentEnrollmentDetail) {
  if (!confirm(`Remove enrollment for ${row.studentName} in ${row.className}?`)) {
    return
  }
  try {
    await peopleApi.removeEnrollment(row.id)
    await loadEnrollments()
  } catch (e) {
    alert(formatApiError(e))
  }
}

onMounted(loadLists)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">← Dashboard</NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">Enrollments</h1>
    </div>

    <div v-if="loadError" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ loadError }}
      <button type="button" class="ml-2 underline" @click="loadLists">Retry</button>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-3">
        <select v-model="sessionFilter" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="loadEnrollments">
          <option value="">All sessions</option>
          <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-model="classFilter" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="loadEnrollments">
          <option value="">All classes</option>
          <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
        </select>
      </div>
      <button v-if="canCreate" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="openCreate">New enrollment</button>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3">Student</th>
            <th class="px-4 py-3">Class / section</th>
            <th class="px-4 py-3">Session / term</th>
            <th class="px-4 py-3">Date</th>
            <th class="px-4 py-3">Status</th>
            <th v-if="canUpdate" class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading"><td colspan="6" class="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
          <tr v-else-if="rows.length === 0"><td colspan="6" class="px-4 py-8 text-center text-gray-500">No enrollments.</td></tr>
          <tr v-for="row in rows" v-else :key="row.id">
            <td class="px-4 py-3 font-medium text-gray-900">{{ row.studentName }}</td>
            <td class="px-4 py-3 text-gray-600">{{ row.className }}<span v-if="row.sectionName"> / {{ row.sectionName }}</span></td>
            <td class="px-4 py-3 text-gray-600">{{ row.sessionName }}<span v-if="row.termName"> · {{ row.termName }}</span></td>
            <td class="px-4 py-3 text-gray-600">{{ row.enrollmentDate }}</td>
            <td class="px-4 py-3"><span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{{ row.status }}</span></td>
            <td v-if="canUpdate" class="px-4 py-3 text-right">
              <button type="button" class="text-xs text-red-600 hover:underline" @click="remove(row)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UiBaseModal :open="modalOpen" title="New enrollment" @close="modalOpen = false">
      <form class="space-y-3" @submit.prevent="submit">
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Student</label>
            <select v-model="form.studentId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Select a student</option>
              <option v-for="s in students" :key="s.id" :value="s.id">{{ s.admissionNumber }} — {{ s.firstName }} {{ s.lastName }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Academic session</label>
            <select v-model="form.sessionId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Select a session</option>
              <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Term</label>
            <select v-model="form.termId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">—</option>
              <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Class</label>
            <select v-model="form.classId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>Select a class</option>
              <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Section</label>
            <select v-model="form.sectionId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Whole class</option>
              <option v-for="sec in classSections" :key="sec.id" :value="sec.id">{{ sec.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Roll no.</label>
            <input v-model="form.rollNumber" maxlength="50" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Status</label>
            <select v-model="form.status" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="promoted">Promoted</option>
              <option value="repeated">Repeated</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Enrollment date</label>
          <input v-model="form.enrollmentDate" type="date" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Notes</label>
          <input v-model="form.notes" maxlength="500" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </form>
      <template #footer>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="modalOpen = false">Cancel</button>
        <button type="button" :disabled="saving || !form.studentId || !form.sessionId || !form.classId" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60" @click="submit">{{ saving ? 'Saving…' : 'Create' }}</button>
      </template>
    </UiBaseModal>
  </div>
</template>
