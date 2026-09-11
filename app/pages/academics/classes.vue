<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi, type ClassDetail } from '~/services/academics'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type { SchoolClass, Subject } from '~/shared/types'

definePageMeta({ permissions: ['classes.view'] })

const auth = useAuthStore()
const canManageClasses = computed(() => auth.can('classes.manage'))
const canManageSections = computed(() => auth.can('sections.manage'))
const canManageClassSubjects = computed(() =>
  auth.can('class_subjects.manage'),
)

// --- Class list -----------------------------------------------------------
const classPage = usePaginated<SchoolClass>(academicsApi.listClasses)
const {
  items: classItems,
  total: classTotal,
  loading: classesLoading,
  error: classesError,
} = classPage

const classModalOpen = ref(false)
const editingClass = ref<SchoolClass | null>(null)
const classSaving = ref(false)
const classFormError = ref<string | null>(null)
const classForm = reactive({ name: '', level: '', sequence: 0 })

async function loadClasses() {
  await classPage.load({ perPage: 100, isActive: true })
}

function openClassCreate() {
  editingClass.value = null
  classFormError.value = null
  Object.assign(classForm, { name: '', level: '', sequence: classItems.value.length })
  classModalOpen.value = true
}

function openClassEdit(klass: SchoolClass) {
  editingClass.value = klass
  classFormError.value = null
  Object.assign(classForm, {
    name: klass.name,
    level: klass.level ?? '',
    sequence: klass.sequence,
  })
  classModalOpen.value = true
}

async function submitClass() {
  classSaving.value = true
  classFormError.value = null
  try {
    const body = {
      name: classForm.name,
      sequence: Number(classForm.sequence) || 0,
      ...(classForm.level ? { level: classForm.level } : {}),
    }
    if (editingClass.value) {
      await academicsApi.updateClass(editingClass.value.id, body)
    } else {
      await academicsApi.createClass(body)
    }
    classModalOpen.value = false
    await loadClasses()
  } catch (e) {
    classFormError.value = formatApiError(e)
  } finally {
    classSaving.value = false
  }
}

async function deactivateClass(klass: SchoolClass) {
  if (!confirm(`Deactivate class "${klass.name}"?`)) {
    return
  }
  try {
    await academicsApi.deactivateClass(klass.id)
    if (selectedClassId.value === klass.id) {
      selectedClassId.value = ''
      detail.value = null
    }
    await loadClasses()
  } catch (e) {
    alert(formatApiError(e))
  }
}

// --- Class detail (sections + subjects) -----------------------------------
const selectedClassId = ref('')
const detail = ref<ClassDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

const subjectCatalog = ref<Subject[]>([])
const newSubjectId = ref('')
const newSection = reactive({ name: '', capacity: '', room: '' })

async function selectClass(id: string) {
  selectedClassId.value = id
  detailLoading.value = true
  detailError.value = null
  try {
    detail.value = await academicsApi.getClass(id)
    newSection.name = ''
    newSection.capacity = ''
    newSection.room = ''
  } catch (e) {
    detail.value = null
    detailError.value = formatApiError(e)
  } finally {
    detailLoading.value = false
  }
}

async function addSection() {
  if (!detail.value || !newSection.name) {
    return
  }
  try {
    await academicsApi.createSection({
      classId: detail.value.id,
      name: newSection.name,
      ...(newSection.capacity
        ? { capacity: Number(newSection.capacity) }
        : {}),
      ...(newSection.room ? { room: newSection.room } : {}),
    })
    await selectClass(detail.value.id)
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function deactivateSection(sectionId: string, name: string) {
  if (!confirm(`Deactivate section "${name}"?`)) {
    return
  }
  try {
    await academicsApi.deactivateSection(sectionId)
    if (detail.value) {
      await selectClass(detail.value.id)
    }
  } catch (e) {
    alert(formatApiError(e))
  }
}

const availableSubjects = computed(() => {
  const linkedIds = new Set(detail.value?.subjects.map((s) => s.subjectId) ?? [])
  return subjectCatalog.value.filter((s) => !linkedIds.has(s.id))
})

async function addClassSubject() {
  if (!detail.value || !newSubjectId.value) {
    return
  }
  try {
    await academicsApi.addClassSubject(detail.value.id, {
      subjectId: newSubjectId.value,
      isCompulsory: true,
    })
    newSubjectId.value = ''
    await selectClass(detail.value.id)
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function toggleCompulsory(
  row: ClassDetail['subjects'][number],
  value: boolean,
) {
  if (!detail.value) {
    return
  }
  try {
    await academicsApi.updateClassSubject(detail.value.id, row.subjectId, {
      isCompulsory: value,
    })
    await selectClass(detail.value.id)
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function saveMaxScore(
  row: ClassDetail['subjects'][number],
  rawValue: string,
) {
  if (!detail.value) {
    return
  }
  try {
    const maxScore = rawValue === '' ? null : Number(rawValue)
    await academicsApi.updateClassSubject(detail.value.id, row.subjectId, {
      maxScore,
    })
    await selectClass(detail.value.id)
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function removeClassSubject(
  row: ClassDetail['subjects'][number],
) {
  if (!detail.value) {
    return
  }
  if (
    !confirm(`Remove "${row.subject.name}" from ${detail.value.name}?`)
  ) {
    return
  }
  try {
    await academicsApi.removeClassSubject(detail.value.id, row.subjectId)
    await selectClass(detail.value.id)
  } catch (e) {
    alert(formatApiError(e))
  }
}

onMounted(async () => {
  await loadClasses()
  if (auth.can('subjects.view')) {
    try {
      const page = await academicsApi.listSubjects({
        perPage: 100,
        isActive: true,
      })
      subjectCatalog.value = page.data
    } catch {
      // Subject catalogue is optional context; list still works.
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
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">
        Classes, sections &amp; subjects
      </h1>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Class list -->
      <section>
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm text-gray-500">{{ classTotal }} class(es)</p>
          <button
            v-if="canManageClasses"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openClassCreate"
          >
            New class
          </button>
        </div>

        <div
          v-if="classesError"
          class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {{ classesError }}
          <button type="button" class="ml-2 underline" @click="loadClasses">Retry</button>
        </div>

        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-4 py-3">Name</th>
                <th class="px-4 py-3">Level</th>
                <th class="px-4 py-3 text-right">#</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="classesLoading">
                <td colspan="3" class="px-4 py-8 text-center text-gray-500">Loading…</td>
              </tr>
              <tr v-else-if="classItems.length === 0">
                <td colspan="3" class="px-4 py-8 text-center text-gray-500">No classes yet.</td>
              </tr>
              <tr
                v-for="klass in classItems"
                v-else
                :key="klass.id"
                class="cursor-pointer hover:bg-indigo-50"
                :class="klass.id === selectedClassId ? 'bg-indigo-50' : ''"
                @click="selectClass(klass.id)"
              >
                <td class="px-4 py-3 font-medium text-gray-900">{{ klass.name }}</td>
                <td class="px-4 py-3 uppercase text-gray-500">{{ klass.level || '—' }}</td>
                <td class="px-4 py-3 text-right text-gray-500">{{ klass.sequence }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Detail panel -->
      <section>
        <div
          v-if="!detail && !detailLoading"
          class="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500"
        >
          Select a class to manage its sections and offered subjects.
        </div>

        <div
          v-else-if="detailLoading"
          class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500"
        >
          Loading class detail…
        </div>

        <div v-else-if="detailError" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {{ detailError }}
        </div>

        <template v-else-if="detail">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">{{ detail.name }}</h2>
            <div class="flex gap-3">
              <button
                v-if="canManageClasses"
                type="button"
                class="text-sm text-indigo-600 hover:underline"
                @click="openClassEdit(detail)"
              >Edit class</button>
              <button
                v-if="canManageClasses && detail.isActive"
                type="button"
                class="text-sm text-red-600 hover:underline"
                @click="deactivateClass(detail)"
              >Deactivate</button>
            </div>
          </div>

          <!-- Sections -->
          <div class="mb-6 rounded-lg border border-gray-200 bg-white">
            <div class="border-b border-gray-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-gray-900">
                Sections ({{ detail.sections.length }})
              </h3>
            </div>
            <ul class="divide-y divide-gray-100 text-sm">
              <li v-if="detail.sections.length === 0" class="px-4 py-4 text-gray-500">
                No sections yet.
              </li>
              <li
                v-for="section in detail.sections"
                :key="section.id"
                class="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p class="font-medium text-gray-900">{{ section.name }}</p>
                  <p class="text-xs text-gray-500">
                    Capacity {{ section.capacity ?? '—' }} · Room {{ section.room || '—' }}
                  </p>
                </div>
                <button
                  v-if="canManageSections"
                  type="button"
                  class="text-xs text-red-600 hover:underline"
                  @click="deactivateSection(section.id, section.name)"
                >Deactivate</button>
              </li>
            </ul>
            <form
              v-if="canManageSections"
              class="flex flex-wrap items-end gap-2 border-t border-gray-100 px-4 py-3"
              @submit.prevent="addSection"
            >
              <div>
                <label class="block text-xs text-gray-500">Name</label>
                <input
                  v-model="newSection.name"
                  required
                  maxlength="100"
                  placeholder="A"
                  class="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500">Capacity</label>
                <input
                  v-model="newSection.capacity"
                  type="number"
                  min="1"
                  class="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500">Room</label>
                <input
                  v-model="newSection.room"
                  maxlength="50"
                  class="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >Add</button>
            </form>
          </div>

          <!-- Subjects offered -->
          <div class="rounded-lg border border-gray-200 bg-white">
            <div class="border-b border-gray-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-gray-900">
                Subjects offered ({{ detail.subjects.length }})
              </h3>
            </div>
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th class="px-4 py-2">Subject</th>
                  <th class="px-4 py-2">Compulsory</th>
                  <th class="px-4 py-2">Max score</th>
                  <th v-if="canManageClassSubjects" class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="detail.subjects.length === 0">
                  <td :colspan="canManageClassSubjects ? 4 : 3" class="px-4 py-4 text-gray-500">
                    No subjects linked yet.
                  </td>
                </tr>
                <tr v-for="row in detail.subjects" :key="row.subjectId">
                  <td class="px-4 py-2">
                    <p class="font-medium text-gray-900">{{ row.subject.name }}</p>
                    <p class="text-xs text-gray-500">{{ row.subject.code || '—' }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <input
                      type="checkbox"
                      class="rounded"
                      :checked="row.isCompulsory"
                      :disabled="!canManageClassSubjects"
                      @change="toggleCompulsory(row, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td class="px-4 py-2">
                    <input
                      :value="row.maxScore ?? ''"
                      type="number"
                      min="1"
                      :disabled="!canManageClassSubjects"
                      class="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                      @change="saveMaxScore(row, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td v-if="canManageClassSubjects" class="px-4 py-2 text-right">
                    <button
                      type="button"
                      class="text-xs text-red-600 hover:underline"
                      @click="removeClassSubject(row)"
                    >Remove</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <form
              v-if="canManageClassSubjects"
              class="flex items-end gap-2 border-t border-gray-100 px-4 py-3"
              @submit.prevent="addClassSubject"
            >
              <div class="flex-1">
                <label class="block text-xs text-gray-500">Add subject</label>
                <select
                  v-model="newSubjectId"
                  class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>Select a subject</option>
                  <option v-for="subject in availableSubjects" :key="subject.id" :value="subject.id">
                    {{ subject.name }}
                  </option>
                </select>
              </div>
              <button
                type="submit"
                :disabled="!newSubjectId"
                class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >Add</button>
            </form>
          </div>
        </template>
      </section>
    </div>

    <!-- Class modal -->
    <UiBaseModal
      :open="classModalOpen"
      :title="editingClass ? 'Edit class' : 'New class'"
      @close="classModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitClass">
        <div v-if="classFormError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ classFormError }}
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <input
            v-model="classForm.name"
            required
            maxlength="100"
            placeholder="JSS 1"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Level</label>
            <input
              v-model="classForm.level"
              maxlength="50"
              placeholder="jss"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Sequence</label>
            <input
              v-model.number="classForm.sequence"
              type="number"
              min="0"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </form>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="classModalOpen = false"
        >Cancel</button>
        <button
          type="button"
          :disabled="classSaving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submitClass"
        >{{ classSaving ? 'Saving…' : 'Save' }}</button>
      </template>
    </UiBaseModal>
  </div>
</template>
