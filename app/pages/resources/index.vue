<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { resourcesApi } from '~/services/assignments'
import { formatApiError } from '~/utils/errors'
import type {
  LearningResourceListItem,
  SchoolClass,
  Subject,
} from '~/shared/types'

definePageMeta({ permissions: ['resources.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('resources.manage'))

const loading = ref(false)
const loadError = ref<string | null>(null)
const resources = ref<LearningResourceListItem[]>([])
const classes = ref<SchoolClass[]>([])
const subjects = ref<Subject[]>([])

const filters = reactive({ classId: '', subjectId: '' })

async function loadAll() {
  loading.value = true
  loadError.value = null
  try {
    const [list, classPage, subjectPage] = await Promise.all([
      resourcesApi.list({
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
      }),
      academicsApi.listClasses({ perPage: 100, isActive: true }),
      academicsApi.listSubjects({ perPage: 200, isActive: true }),
    ])
    resources.value = list.data
    classes.value = classPage.data
    subjects.value = subjectPage.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => [filters.classId, filters.subjectId],
  () => {
    void loadAll()
  },
)

onMounted(loadAll)

// --- Upload / edit ---------------------------------------------------------
const modalOpen = ref(false)
const editing = ref<LearningResourceListItem | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  title: '',
  description: '',
  classId: '',
  subjectId: '',
  isPublished: true,
})
const file = ref<File | null>(null)

function openUpload() {
  editing.value = null
  Object.assign(form, {
    title: '',
    description: '',
    classId: '',
    subjectId: '',
    isPublished: true,
  })
  file.value = null
  formError.value = null
  modalOpen.value = true
}

function openEdit(r: LearningResourceListItem) {
  editing.value = r
  Object.assign(form, {
    title: r.title,
    description: r.description ?? '',
    classId: r.classId ?? '',
    subjectId: r.subjectId ?? '',
    isPublished: r.isPublished,
  })
  file.value = null
  formError.value = null
  modalOpen.value = true
}

async function submitForm() {
  saving.value = true
  formError.value = null
  try {
    if (editing.value) {
      await resourcesApi.update(editing.value.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        classId: form.classId || null,
        subjectId: form.subjectId || null,
        isPublished: form.isPublished,
      })
    } else {
      if (!file.value) {
        throw new Error('Choose a file to upload.')
      }
      await resourcesApi.upload(
        {
          title: form.title.trim(),
          description: form.description.trim() || null,
          classId: form.classId || null,
          subjectId: form.subjectId || null,
          isPublished: form.isPublished,
        },
        file.value,
      )
    }
    modalOpen.value = false
    await loadAll()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function removeResource(r: LearningResourceListItem) {
  if (!confirm(`Delete resource "${r.title}"? The stored file will be removed.`)) {
    return
  }
  try {
    await resourcesApi.remove(r.id)
    await loadAll()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Learning resources</h1>
        <p class="mt-1 text-sm text-gray-500">
          Documents and files shared school-wide or for specific classes.
        </p>
      </div>
      <button
        v-if="canManage"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openUpload"
      >
        Upload resource
      </button>
    </div>

    <div class="flex flex-wrap gap-3">
      <select v-model="filters.classId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">All classes / school-wide</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-model="filters.subjectId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">All subjects</option>
        <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ loadError }}</p>
    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
    <div v-else-if="resources.length === 0" class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
      No resources found.
    </div>

    <ul v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="r in resources"
        :key="r.id"
        class="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-2">
          <h2 class="text-sm font-medium text-gray-900">{{ r.title }}</h2>
          <span
            v-if="canManage && !r.isPublished"
            class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            draft
          </span>
        </div>
        <p v-if="r.description" class="mt-1 line-clamp-3 text-sm text-gray-500">{{ r.description }}</p>
        <p class="mt-2 text-xs text-gray-400">
          {{ r.className ?? 'School-wide' }}<template v-if="r.subjectName"> · {{ r.subjectName }}</template>
          · {{ r.fileName }}
        </p>
        <div class="mt-3 flex items-center gap-3 text-sm">
          <a
            :href="resourcesApi.downloadUrl(r.id)"
            target="_blank"
            class="font-medium text-indigo-700 hover:underline"
          >
            Download
          </a>
          <template v-if="canManage">
            <button class="text-gray-600 hover:underline" @click="openEdit(r)">Edit</button>
            <button class="text-red-700 hover:underline" @click="removeResource(r)">Delete</button>
          </template>
        </div>
      </li>
    </ul>

    <BaseModal
      :open="modalOpen"
      :title="editing ? 'Edit resource' : 'Upload resource'"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitForm">
        <p v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Title</span>
          <input v-model="form.title" required maxlength="255" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Description</span>
          <textarea v-model="form.description" rows="3" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Class (optional)</span>
            <select v-model="form.classId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">School-wide</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block font-medium text-gray-700">Subject (optional)</span>
            <select v-model="form.subjectId" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">No subject</option>
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
        </div>
        <label v-if="!editing" class="block text-sm">
          <span class="block font-medium text-gray-700">File</span>
          <input
            type="file"
            required
            class="mt-1 w-full text-sm"
            @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
          />
          <span class="mt-1 block text-xs text-gray-400">
            PDF, Office documents, images, text or ZIP · up to 50 MB.
          </span>
        </label>
        <p v-else class="text-sm text-gray-500">
          Replacing the stored file is not supported here; delete and re-upload to change it.
        </p>
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="form.isPublished" type="checkbox" />
          Published (visible to eligible students)
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" @click="modalOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Upload' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
