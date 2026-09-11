<script setup lang="ts">
import { academicsApi, type TeacherLookup } from '~/services/academics'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  ClassSubjectDetail,
  SchoolClass,
  Section,
  Subject,
  TeacherClassAssignmentDetail,
  TeacherSubjectDetail,
} from '~/shared/types'

definePageMeta({ permissions: ['teacher_assignments.manage'] })

const loading = ref(false)
const loadError = ref<string | null>(null)

const sessions = ref<AcademicSession[]>([])
const sessionId = ref('')
const teachers = ref<TeacherLookup[]>([])
const classes = ref<SchoolClass[]>([])
const assignments = ref<TeacherClassAssignmentDetail[]>([])
const subjectCatalog = ref<Subject[]>([])

async function loadBaseData() {
  loading.value = true
  loadError.value = null
  try {
    const [sessionPage, teacherRes, classPage, subjectPage] =
      await Promise.all([
        academicsApi.listSessions({ perPage: 100 }),
        academicsApi.listTeachers(),
        academicsApi.listClasses({ perPage: 100, isActive: true }),
        academicsApi.listSubjects({ perPage: 100, isActive: true }),
      ])
    sessions.value = sessionPage.data
    teachers.value = teacherRes.data
    classes.value = classPage.data
    subjectCatalog.value = subjectPage.data
    sessionId.value =
      sessions.value.find((s) => s.isCurrent)?.id ??
      sessions.value[0]?.id ??
      ''
    await loadAssignments()
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function loadAssignments() {
  if (!sessionId.value) {
    assignments.value = []
    return
  }
  try {
    const res = await academicsApi.listAssignments({
      sessionId: sessionId.value,
      perPage: 200,
    })
    assignments.value = res.data
  } catch (e) {
    alert(formatApiError(e))
  }
}

// --- Teacher subject capabilities -----------------------------------------
const capabilityTeacherId = ref('')
const teacherSubjects = ref<TeacherSubjectDetail[]>([])
const capabilityLoading = ref(false)
const newCapabilitySubjectId = ref('')

async function loadTeacherSubjects() {
  if (!capabilityTeacherId.value) {
    teacherSubjects.value = []
    return
  }
  capabilityLoading.value = true
  try {
    const res = await academicsApi.listTeacherSubjects(
      capabilityTeacherId.value,
    )
    teacherSubjects.value = res.data
  } catch (e) {
    alert(formatApiError(e))
  } finally {
    capabilityLoading.value = false
  }
}

watch(capabilityTeacherId, loadTeacherSubjects)

async function addCapability() {
  if (!capabilityTeacherId.value || !newCapabilitySubjectId.value) {
    return
  }
  try {
    await academicsApi.addTeacherSubject({
      teacherId: capabilityTeacherId.value,
      subjectId: newCapabilitySubjectId.value,
    })
    newCapabilitySubjectId.value = ''
    await loadTeacherSubjects()
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function removeCapability(row: TeacherSubjectDetail) {
  if (!confirm(`Remove "${row.subject.name}" from this teacher?`)) {
    return
  }
  try {
    await academicsApi.removeTeacherSubject(
      row.teacherId,
      row.subjectId,
    )
    await loadTeacherSubjects()
  } catch (e) {
    alert(formatApiError(e))
  }
}

const availableCapabilitySubjects = computed(() => {
  const linkedIds = new Set(teacherSubjects.value.map((t) => t.subjectId))
  return subjectCatalog.value.filter((s) => !linkedIds.has(s.id))
})

// --- Assignment create modal ----------------------------------------------
const modalOpen = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const classSections = ref<Section[]>([])
const offeredSubjects = ref<ClassSubjectDetail[]>([])

const form = reactive({
  teacherId: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  isPrimaryTeacher: false,
})

function openCreate() {
  formError.value = null
  classSections.value = []
  offeredSubjects.value = []
  Object.assign(form, {
    teacherId: teachers.value[0]?.id ?? '',
    classId: '',
    sectionId: '',
    subjectId: '',
    isPrimaryTeacher: false,
  })
  modalOpen.value = true
}

watch(
  () => form.classId,
  async (classId) => {
    form.sectionId = ''
    form.subjectId = ''
    classSections.value = []
    offeredSubjects.value = []
    if (!classId) {
      return
    }
    try {
      const detail = await academicsApi.getClass(classId)
      classSections.value = detail.sections
      offeredSubjects.value = detail.subjects
    } catch (e) {
      alert(formatApiError(e))
    }
  },
)

async function submit() {
  saving.value = true
  formError.value = null
  try {
    await academicsApi.createAssignment({
      teacherId: form.teacherId,
      classId: form.classId,
      subjectId: form.subjectId,
      sessionId: sessionId.value,
      ...(form.sectionId ? { sectionId: form.sectionId } : {}),
      isPrimaryTeacher: form.isPrimaryTeacher,
    })
    modalOpen.value = false
    await loadAssignments()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function removeAssignment(row: TeacherClassAssignmentDetail) {
  if (
    !confirm(
      `Remove assignment: ${row.teacherName} — ${row.subjectName} (${row.className}${row.sectionName ? ' / ' + row.sectionName : ''})?`,
    )
  ) {
    return
  }
  try {
    await academicsApi.removeAssignment(row.id)
    await loadAssignments()
  } catch (e) {
    alert(formatApiError(e))
  }
}

onMounted(loadBaseData)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">
        ← Dashboard
      </NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">
        Teacher assignments
      </h1>
    </div>

    <div
      v-if="loadError"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ loadError }}
      <button type="button" class="ml-2 underline" @click="loadBaseData">Retry</button>
    </div>

    <!-- Teacher capabilities -->
    <section class="mb-8 rounded-lg border border-gray-200 bg-white p-4">
      <h2 class="mb-3 text-sm font-semibold text-gray-900">
        Teacher subjects
      </h2>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-gray-500">Teacher</label>
          <select
            v-model="capabilityTeacherId"
            class="min-w-[220px] rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="" disabled>Select a teacher</option>
            <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
              {{ teacher.name }} ({{ teacher.staffNumber }})
            </option>
          </select>
        </div>
        <form class="flex items-end gap-2" @submit.prevent="addCapability">
          <div>
            <label class="block text-xs text-gray-500">Add subject</label>
            <select
              v-model="newCapabilitySubjectId"
              :disabled="!capabilityTeacherId"
              class="min-w-[200px] rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
            >
              <option value="" disabled>Select a subject</option>
              <option v-for="subject in availableCapabilitySubjects" :key="subject.id" :value="subject.id">
                {{ subject.name }}
              </option>
            </select>
          </div>
          <button
            type="submit"
            :disabled="!capabilityTeacherId || !newCapabilitySubjectId"
            class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >Add</button>
        </form>
      </div>

      <div v-if="capabilityTeacherId" class="mt-4">
        <p v-if="capabilityLoading" class="text-sm text-gray-500">Loading…</p>
        <div v-else-if="teacherSubjects.length === 0" class="text-sm text-gray-500">
          This teacher has no subjects yet.
        </div>
        <ul v-else class="flex flex-wrap gap-2">
          <li
            v-for="row in teacherSubjects"
            :key="row.subjectId"
            class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-800"
          >
            {{ row.subject.name }}
            <button
              type="button"
              aria-label="Remove subject"
              class="text-indigo-500 hover:text-red-600"
              @click="removeCapability(row)"
            >✕</button>
          </li>
        </ul>
      </div>
    </section>

    <!-- Assignments for session -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-semibold text-gray-900">Assignments</h2>
          <select
            v-model="sessionId"
            class="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            @change="loadAssignments"
          >
            <option v-for="session in sessions" :key="session.id" :value="session.id">
              {{ session.name }}
            </option>
          </select>
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openCreate"
        >New assignment</button>
      </div>

      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3">Teacher</th>
            <th class="px-4 py-3">Class / section</th>
            <th class="px-4 py-3">Subject</th>
            <th class="px-4 py-3">Primary</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">Loading…</td>
          </tr>
          <tr v-else-if="assignments.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
              No assignments for this session.
            </td>
          </tr>
          <tr v-for="row in assignments" v-else :key="row.id">
            <td class="px-4 py-3 font-medium text-gray-900">{{ row.teacherName }}</td>
            <td class="px-4 py-3 text-gray-600">
              {{ row.className }}<span v-if="row.sectionName"> / {{ row.sectionName }}</span>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ row.subjectName }}</td>
            <td class="px-4 py-3">
              <span
                v-if="row.isPrimaryTeacher"
                class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
              >Primary</span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="text-xs text-red-600 hover:underline"
                @click="removeAssignment(row)"
              >Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Create modal -->
    <UiBaseModal
      :open="modalOpen"
      title="New teacher assignment"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ formError }}
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Teacher</label>
          <select
            v-model="form.teacherId"
            required
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a teacher</option>
            <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
              {{ teacher.name }} ({{ teacher.staffNumber }})
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Class</label>
          <select
            v-model="form.classId"
            required
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a class</option>
            <option v-for="klass in classes" :key="klass.id" :value="klass.id">
              {{ klass.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">
            Section <span class="font-normal text-gray-400">(optional — whole class if blank)</span>
          </label>
          <select
            v-model="form.sectionId"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Whole class</option>
            <option v-for="section in classSections" :key="section.id" :value="section.id">
              {{ section.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Subject</label>
          <select
            v-model="form.subjectId"
            required
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a subject offered by this class</option>
            <option v-for="row in offeredSubjects" :key="row.subjectId" :value="row.subjectId">
              {{ row.subject.name }}
            </option>
          </select>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
          <input v-model="form.isPrimaryTeacher" type="checkbox" class="rounded" />
          Primary teacher for this class/section
        </label>
      </form>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="modalOpen = false"
        >Cancel</button>
        <button
          type="button"
          :disabled="saving || !form.teacherId || !form.classId || !form.subjectId"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submit"
        >{{ saving ? 'Saving…' : 'Create assignment' }}</button>
      </template>
    </UiBaseModal>
  </div>
</template>
