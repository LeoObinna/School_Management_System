<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { peopleApi } from '~/services/people'
import { academicsApi } from '~/services/academics'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type {
  Gender,
  Parent,
  SchoolClass,
  Student,
  StudentEnrollmentDetail,
  StudentParentDetail,
  StudentStatus,
} from '~/shared/types'

definePageMeta({ permissions: ['students.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('students.create'))
const canUpdate = computed(() => auth.can('students.update'))
const canDelete = computed(() => auth.can('students.delete'))
const canLinkParents = computed(() => auth.can('parents.link_children'))

const page = usePaginated<Student>(peopleApi.listStudents)
const { items, total, loading, error, load } = page
const statusFilter = ref('')
const classFilter = ref('')

const classes = ref<SchoolClass[]>([])

const modalOpen = ref(false)
const editing = ref<Student | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  admissionNumber: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  gender: '',
  dateOfBirth: '',
  status: 'applicant',
  currentClassId: '',
  enrolledAt: '',
})

async function refresh() {
  await load({
    perPage: 100,
    ...(statusFilter.value ? { status: statusFilter.value } : {}),
    ...(classFilter.value ? { currentClassId: classFilter.value } : {}),
  })
}

function openCreate() {
  editing.value = null
  formError.value = null
  Object.assign(form, {
    admissionNumber: '',
    firstName: '',
    lastName: '',
    otherNames: '',
    gender: '',
    dateOfBirth: '',
    status: 'applicant',
    currentClassId: '',
    enrolledAt: '',
  })
  modalOpen.value = true
}

function openEdit(student: Student) {
  editing.value = student
  formError.value = null
  Object.assign(form, {
    admissionNumber: student.admissionNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    otherNames: student.otherNames ?? '',
    gender: student.gender ?? '',
    dateOfBirth: student.dateOfBirth ?? '',
    status: student.status,
    currentClassId: student.currentClassId ?? '',
    enrolledAt: student.enrolledAt ?? '',
  })
  modalOpen.value = true
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    const body = {
      admissionNumber: form.admissionNumber,
      firstName: form.firstName,
      lastName: form.lastName,
      status: form.status as StudentStatus,
      ...(form.otherNames ? { otherNames: form.otherNames } : {}),
      ...(form.gender ? { gender: form.gender as Gender } : {}),
      ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
      ...(form.currentClassId ? { currentClassId: form.currentClassId } : {}),
      ...(form.enrolledAt ? { enrolledAt: form.enrolledAt } : {}),
    }
    if (editing.value) {
      await peopleApi.updateStudent(editing.value.id, body)
    } else {
      await peopleApi.createStudent(body)
    }
    modalOpen.value = false
    await refresh()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function archive(student: Student) {
  if (!confirm(`Archive student ${student.admissionNumber}? Records are retained.`)) {
    return
  }
  try {
    await peopleApi.archiveStudent(student.id)
    if (selectedId.value === student.id) {
      selectedId.value = ''
      detailParents.value = []
      detailEnrollments.value = []
    }
    await refresh()
  } catch (e) {
    alert(formatApiError(e))
  }
}

// --- Detail: parents + enrollments ----------------------------------------
const selectedId = ref('')
const detailParents = ref<StudentParentDetail[]>([])
const detailEnrollments = ref<StudentEnrollmentDetail[]>([])
const detailLoading = ref(false)
const parentCatalog = ref<Parent[]>([])

const linkParentId = ref('')
const linkRelationship = ref('Mother')
const linkPrimary = ref(true)
const linkEmergency = ref(true)

async function selectStudent(id: string) {
  selectedId.value = id
  detailLoading.value = true
  try {
    const [parentsRes, enrollmentsRes] = await Promise.all([
      peopleApi.listStudentParents(id),
      peopleApi.listStudentEnrollments(id),
    ])
    detailParents.value = parentsRes.data
    detailEnrollments.value = enrollmentsRes.data
  } catch (e) {
    alert(formatApiError(e))
  } finally {
    detailLoading.value = false
  }
}

async function addParentLink() {
  if (!selectedId.value || !linkParentId.value) {
    return
  }
  try {
    await peopleApi.addStudentParent(selectedId.value, {
      parentId: linkParentId.value,
      relationship: linkRelationship.value,
      isPrimary: linkPrimary.value,
      isEmergencyContact: linkEmergency.value,
    })
    linkParentId.value = ''
    await selectStudent(selectedId.value)
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function removeParentLink(row: StudentParentDetail) {
  if (!selectedId.value) {
    return
  }
  if (!confirm(`Remove ${row.parent.firstName} ${row.parent.lastName}?`)) {
    return
  }
  try {
    await peopleApi.removeStudentParent(selectedId.value, row.parentId)
    await selectStudent(selectedId.value)
  } catch (e) {
    alert(formatApiError(e))
  }
}

const availableParents = computed(() => {
  const linked = new Set(detailParents.value.map((p) => p.parentId))
  return parentCatalog.value.filter((p) => !linked.has(p.id))
})

onMounted(async () => {
  await refresh()
  if (auth.can('classes.view')) {
    try {
      classes.value = (await academicsApi.listClasses({ perPage: 100, isActive: true })).data
    } catch {
      /* optional */
    }
  }
  if (auth.can('parents.view')) {
    try {
      parentCatalog.value = (await peopleApi.listParents({ perPage: 500, isActive: true })).data
    } catch {
      /* optional */
    }
  }
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">
        ← Dashboard
      </NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">Students</h1>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-500">{{ total }} student(s)</p>
          <button
            v-if="canCreate"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openCreate"
          >New student</button>
        </div>
        <div class="mb-4 flex flex-wrap gap-3">
          <select v-model="statusFilter" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="refresh">
            <option value="">All statuses</option>
            <option value="applicant">Applicant</option>
            <option value="admitted">Admitted</option>
            <option value="enrolled">Enrolled</option>
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="archived">Archived</option>
          </select>
          <select v-model="classFilter" class="rounded-md border border-gray-300 px-2 py-1.5 text-sm" @change="refresh">
            <option value="">All classes</option>
            <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
          </select>
        </div>

        <div v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {{ error }}
          <button type="button" class="ml-2 underline" @click="refresh">Retry</button>
        </div>

        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-4 py-3">Adm no.</th>
                <th class="px-4 py-3">Name</th>
                <th class="px-4 py-3">Status</th>
                <th v-if="canUpdate || canDelete" class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="loading"><td colspan="4" class="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              <tr v-else-if="items.length === 0"><td colspan="4" class="px-4 py-8 text-center text-gray-500">No students.</td></tr>
              <tr
                v-for="student in items"
                v-else
                :key="student.id"
                class="cursor-pointer hover:bg-indigo-50"
                :class="student.id === selectedId ? 'bg-indigo-50' : ''"
                @click="selectStudent(student.id)"
              >
                <td class="px-4 py-3 text-gray-600">{{ student.admissionNumber }}</td>
                <td class="px-4 py-3 font-medium text-gray-900">{{ student.firstName }} {{ student.lastName }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">{{ student.status }}</span>
                </td>
                <td v-if="canUpdate || canDelete" class="px-4 py-3 text-right" @click.stop>
                  <button v-if="canUpdate" type="button" class="mr-3 text-indigo-600 hover:underline" @click="openEdit(student)">Edit</button>
                  <button v-if="canDelete" type="button" class="text-red-600 hover:underline" @click="archive(student)">Archive</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div v-if="!selectedId" class="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Select a student to view guardians and enrollment history.
        </div>
        <div v-else-if="detailLoading" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading…</div>
        <template v-else>
          <div class="mb-4 rounded-lg border border-gray-200 bg-white">
            <div class="border-b border-gray-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-gray-900">Guardians ({{ detailParents.length }})</h3>
            </div>
            <ul class="divide-y divide-gray-100 text-sm">
              <li v-if="detailParents.length === 0" class="px-4 py-4 text-gray-500">No guardians linked.</li>
              <li v-for="row in detailParents" :key="row.parentId" class="flex items-center justify-between px-4 py-3">
                <div>
                  <p class="font-medium text-gray-900">{{ row.parent.firstName }} {{ row.parent.lastName }}</p>
                  <p class="text-xs text-gray-500">
                    {{ row.relationship }}
                    <span v-if="row.isPrimary" class="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">primary</span>
                    <span v-if="row.isEmergencyContact" class="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-orange-700">emergency</span>
                  </p>
                  <p class="text-xs text-gray-400">{{ row.parent.email || row.parent.phone || '—' }}</p>
                </div>
                <button v-if="canLinkParents" type="button" class="text-xs text-red-600 hover:underline" @click="removeParentLink(row)">Remove</button>
              </li>
            </ul>
            <form v-if="canLinkParents" class="flex flex-wrap items-end gap-2 border-t border-gray-100 px-4 py-3" @submit.prevent="addParentLink">
              <div>
                <label class="block text-xs text-gray-500">Parent</label>
                <select v-model="linkParentId" class="min-w-[180px] rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option value="" disabled>Select a parent</option>
                  <option v-for="p in availableParents" :key="p.id" :value="p.id">{{ p.firstName }} {{ p.lastName }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500">Relationship</label>
                <input v-model="linkRelationship" class="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <label class="inline-flex items-center gap-1 text-xs text-gray-600"><input v-model="linkPrimary" type="checkbox" />Primary</label>
              <label class="inline-flex items-center gap-1 text-xs text-gray-600"><input v-model="linkEmergency" type="checkbox" />Emergency</label>
              <button type="submit" :disabled="!linkParentId" class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">Link</button>
            </form>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white">
            <div class="border-b border-gray-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-gray-900">Enrollment history</h3>
            </div>
            <ul class="divide-y divide-gray-100 text-sm">
              <li v-if="detailEnrollments.length === 0" class="px-4 py-4 text-gray-500">No enrollments.</li>
              <li v-for="row in detailEnrollments" :key="row.id" class="px-4 py-3">
                <p class="font-medium text-gray-900">{{ row.className }}<span v-if="row.sectionName"> / {{ row.sectionName }}</span></p>
                <p class="text-xs text-gray-500">{{ row.sessionName }}<span v-if="row.termName"> · {{ row.termName }}</span> · {{ row.enrollmentDate }} · {{ row.status }}</p>
              </li>
            </ul>
          </div>
        </template>
      </section>
    </div>

    <UiBaseModal :open="modalOpen" :title="editing ? 'Edit student' : 'New student'" @close="modalOpen = false">
      <form class="space-y-3" @submit.prevent="submit">
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Admission number</label>
            <input v-model="form.admissionNumber" required maxlength="50" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Status</label>
            <select v-model="form.status" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="applicant">Applicant</option>
              <option value="admitted">Admitted</option>
              <option value="enrolled">Enrolled</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">First name</label>
            <input v-model="form.firstName" required maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Last name</label>
            <input v-model="form.lastName" required maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Other names</label>
            <input v-model="form.otherNames" maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Gender</label>
            <select v-model="form.gender" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Date of birth</label>
            <input v-model="form.dateOfBirth" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Enrolled at</label>
            <input v-model="form.enrolledAt" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Current class</label>
          <select v-model="form.currentClassId" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">—</option>
            <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
          </select>
        </div>
      </form>
      <template #footer>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="modalOpen = false">Cancel</button>
        <button type="button" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60" @click="submit">{{ saving ? 'Saving…' : 'Save' }}</button>
      </template>
    </UiBaseModal>
  </div>
</template>
