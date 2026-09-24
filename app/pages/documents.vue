<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { documentsApi } from '~/services/documents'
import { formatApiError } from '~/utils/errors'
import type { DocumentListItem } from '~/shared/types'
import type { DocumentVisibility } from '~/shared/schemas'

definePageMeta({ permissions: ['documents.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('documents.manage'))

const R2_NOTICE =
  'Document upload/download requires `npm run cf:dev` or a deployed environment'

// ---------------------------------------------------------------------------
// List + filters
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(R2_NOTICE)
const documents = ref<DocumentListItem[]>([])

const search = ref('')
const visibilityFilter = ref<DocumentVisibility | ''>('')

async function loadDocuments() {
  loading.value = true
  loadError.value = null
  try {
    const result = await documentsApi.list({
      search: search.value || undefined,
      visibility: visibilityFilter.value || undefined,
    })
    documents.value = result.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadDocuments()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function fmtBytes(value: number | null): string {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function visibilityLabel(v: DocumentVisibility): string {
  return v === 'admin' ? 'Admins only' : 'All staff'
}

function downloadUrl(id: string): string {
  // Same-origin authorized stream; open in a new tab.
  return documentsApi.downloadUrl(id)
}

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

const uploadOpen = ref(false)
const uploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadFile = ref<File | null>(null)
const uploadForm = reactive({
  title: '',
  description: '',
  category: '',
  visibility: 'staff' as DocumentVisibility,
})

function resetUploadForm() {
  Object.assign(uploadForm, {
    title: '',
    description: '',
    category: '',
    visibility: 'staff',
  })
  uploadFile.value = null
  uploadError.value = null
}

function openUpload() {
  resetUploadForm()
  uploadOpen.value = true
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  uploadFile.value = input.files?.[0] ?? null
}

async function submitUpload() {
  if (!uploadFile.value) {
    uploadError.value = 'Please choose a file.'
    return
  }
  if (!uploadForm.title.trim()) {
    uploadError.value = 'Title is required.'
    return
  }
  uploading.value = true
  uploadError.value = null
  try {
    const form = new FormData()
    form.append('file', uploadFile.value)
    form.append('title', uploadForm.title)
    form.append('description', uploadForm.description)
    form.append('category', uploadForm.category)
    form.append('visibility', uploadForm.visibility)
    await documentsApi.create(form)
    uploadOpen.value = false
    await loadDocuments()
  } catch (e) {
    uploadError.value = formatApiError(e)
  } finally {
    uploading.value = false
  }
}

// ---------------------------------------------------------------------------
// Edit metadata
// ---------------------------------------------------------------------------

const editOpen = ref(false)
const saving = ref(false)
const editError = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editForm = reactive({
  title: '',
  description: '',
  category: '',
  visibility: 'staff' as DocumentVisibility,
})

function openEdit(doc: DocumentListItem) {
  editingId.value = doc.id
  Object.assign(editForm, {
    title: doc.title,
    description: doc.description ?? '',
    category: doc.category ?? '',
    visibility: doc.visibility,
  })
  editError.value = null
  editOpen.value = true
}

async function saveEdit() {
  if (!editingId.value) return
  saving.value = true
  editError.value = null
  try {
    await documentsApi.update(editingId.value, {
      title: editForm.title,
      description: editForm.description || null,
      category: editForm.category || null,
      visibility: editForm.visibility,
    })
    editOpen.value = false
    await loadDocuments()
  } catch (e) {
    editError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

async function removeDocument(doc: DocumentListItem) {
  if (!window.confirm(`Delete document "${doc.title}"? This cannot be undone.`)) return
  try {
    await documentsApi.remove(doc.id)
    await loadDocuments()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <header class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Documents</h1>
        <p class="mt-1 text-sm text-gray-500">
          School policies, letters, certificates and other staff documents
        </p>
      </div>
      <button
        v-if="canManage"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openUpload"
      >
        Upload document
      </button>
    </header>

    <p v-if="notice" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ notice }}
    </p>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex-1 min-w-[200px]">
        <input
          v-model="search"
          type="search"
          placeholder="Search by title or description…"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          @keydown.enter="loadDocuments"
        />
      </div>
      <select
        v-model="visibilityFilter"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
        @change="loadDocuments"
      >
        <option value="">All visibility</option>
        <option value="staff">All staff</option>
        <option value="admin">Admins only</option>
      </select>
      <button
        class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        @click="loadDocuments"
      >
        Refresh
      </button>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- List -->
    <div
      v-if="loading"
      class="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500"
    >
      Loading documents…
    </div>
    <div
      v-else-if="documents.length === 0"
      class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center"
    >
      <p class="text-sm text-gray-500">
        No documents yet.
        <button
          v-if="canManage"
          class="font-medium text-indigo-600 hover:underline"
          @click="openUpload"
        >
          Upload the first one
        </button>
      </p>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="truncate font-medium text-gray-900">{{ doc.title }}</h3>
            <p v-if="doc.description" class="mt-1 text-sm text-gray-600">
              {{ doc.description }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>{{ doc.fileName }}</span>
              <span v-if="doc.category">· {{ doc.category }}</span>
              <span>· {{ fmtBytes(doc.sizeBytes) }}</span>
              <span>· {{ fmtDate(doc.createdAt) }}</span>
              <span v-if="doc.createdByName">· by {{ doc.createdByName }}</span>
            </div>
            <span
              class="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
              :class="
                doc.visibility === 'admin'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-indigo-50 text-indigo-700'
              "
            >
              {{ visibilityLabel(doc.visibility) }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <a
              :href="downloadUrl(doc.id)"
              target="_blank"
              rel="noopener"
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download
            </a>
            <button
              v-if="canManage"
              class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              @click="openEdit(doc)"
            >
              Edit
            </button>
            <button
              v-if="canManage"
              class="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              @click="removeDocument(doc)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload modal -->
    <BaseModal
      :open="uploadOpen"
      title="Upload document"
      @close="uploadOpen = false"
    >
      <div class="space-y-4">
        <label class="block">
          <span class="block text-sm font-medium text-gray-700">Title *</span>
          <input
            v-model="uploadForm.title"
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block">
          <span class="block text-sm font-medium text-gray-700">Description</span>
          <textarea
            v-model="uploadForm.description"
            rows="2"
            maxlength="5000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm font-medium text-gray-700">Category</span>
            <input
              v-model="uploadForm.category"
              maxlength="100"
              placeholder="e.g. Policy, Certificate"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-gray-700">Visibility</span>
            <select
              v-model="uploadForm.visibility"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="staff">All staff</option>
              <option value="admin">Admins only</option>
            </select>
          </label>
        </div>
        <label class="block">
          <span class="block text-sm font-medium text-gray-700">File *</span>
          <input
            type="file"
            class="mt-1 block w-full text-sm"
            @change="onFileChange"
          />
          <span class="mt-1 block text-xs text-gray-500">
            PDF, Office documents, images and text, up to 25 MB
          </span>
        </label>
        <p v-if="uploadError" class="text-sm text-red-700">{{ uploadError }}</p>
        <div class="flex justify-end gap-2">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="uploadOpen = false"
          >
            Cancel
          </button>
          <button
            :disabled="uploading"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            @click="submitUpload"
          >
            {{ uploading ? 'Uploading…' : 'Upload' }}
          </button>
        </div>
      </div>
    </BaseModal>

    <!-- Edit metadata modal -->
    <BaseModal
      :open="editOpen"
      title="Edit document"
      @close="editOpen = false"
    >
      <div class="space-y-4">
        <label class="block">
          <span class="block text-sm font-medium text-gray-700">Title *</span>
          <input
            v-model="editForm.title"
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block">
          <span class="block text-sm font-medium text-gray-700">Description</span>
          <textarea
            v-model="editForm.description"
            rows="2"
            maxlength="5000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-sm font-medium text-gray-700">Category</span>
            <input
              v-model="editForm.category"
              maxlength="100"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-gray-700">Visibility</span>
            <select
              v-model="editForm.visibility"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="staff">All staff</option>
              <option value="admin">Admins only</option>
            </select>
          </label>
        </div>
        <p class="text-xs text-gray-500">
          To replace the file itself, delete this document and upload a new one.
        </p>
        <p v-if="editError" class="text-sm text-red-700">{{ editError }}</p>
        <div class="flex justify-end gap-2">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="editOpen = false"
          >
            Cancel
          </button>
          <button
            :disabled="saving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            @click="saveEdit"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
