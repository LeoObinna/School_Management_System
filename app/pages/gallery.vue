<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { galleryApi } from '~/services/events'
import { formatApiError } from '~/utils/errors'
import type {
  GalleryAlbumDetail,
  GalleryAlbumListItem,
  GalleryImage,
} from '~/shared/types'

definePageMeta({ permissions: ['gallery.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('gallery.manage'))

const R2_NOTICE =
  'Image upload/download requires `npm run cf:dev` or a deployed environment'

// ---------------------------------------------------------------------------
// Album list + pagination
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(R2_NOTICE)
const albums = ref<GalleryAlbumListItem[]>([])

const page = ref(1)
const perPage = 12
const total = ref(0)
const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

async function loadAlbums() {
  loading.value = true
  loadError.value = null
  try {
    const result = await galleryApi.listAlbums({
      page: page.value,
      perPage,
    })
    albums.value = result.data
    total.value = result.meta.total
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAlbums()
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

// ---------------------------------------------------------------------------
// Album create / edit modal
// ---------------------------------------------------------------------------

const albumModalOpen = ref(false)
const editingAlbumId = ref<string | null>(null)
const albumSaving = ref(false)
const albumError = ref<string | null>(null)
const albumForm = reactive({
  title: '',
  description: '',
  eventId: '',
  isPublished: false,
})

function resetAlbumForm() {
  Object.assign(albumForm, {
    title: '',
    description: '',
    eventId: '',
    isPublished: false,
  })
}

function openCreateAlbum() {
  editingAlbumId.value = null
  resetAlbumForm()
  albumError.value = null
  albumModalOpen.value = true
}

function openEditAlbum(album: GalleryAlbumListItem) {
  editingAlbumId.value = album.id
  Object.assign(albumForm, {
    title: album.title,
    description: album.description ?? '',
    eventId: album.eventId ?? '',
    isPublished: album.isPublished,
  })
  albumError.value = null
  albumModalOpen.value = true
}

async function submitAlbumForm() {
  albumSaving.value = true
  albumError.value = null
  const body = {
    title: albumForm.title.trim(),
    description: albumForm.description.trim() || null,
    eventId: albumForm.eventId.trim() || null,
    isPublished: albumForm.isPublished,
  }
  try {
    if (editingAlbumId.value) {
      await galleryApi.updateAlbum(editingAlbumId.value, body)
    } else {
      await galleryApi.createAlbum(body)
    }
    albumModalOpen.value = false
    await loadAlbums()
  } catch (e) {
    albumError.value = formatApiError(e)
  } finally {
    albumSaving.value = false
  }
}

async function deleteAlbum(album: GalleryAlbumListItem) {
  if (!window.confirm(`Delete album "${album.title}" and all its images?`)) {
    return
  }
  try {
    await galleryApi.deleteAlbum(album.id)
    await loadAlbums()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}

// ---------------------------------------------------------------------------
// Album detail modal
// ---------------------------------------------------------------------------

const detailOpen = ref(false)
const detailLoading = ref(false)
const selected = ref<GalleryAlbumDetail | null>(null)

async function openDetail(album: GalleryAlbumListItem) {
  detailOpen.value = true
  detailLoading.value = true
  selected.value = null
  try {
    selected.value = await galleryApi.getAlbum(album.id)
  } catch (e) {
    loadError.value = formatApiError(e)
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

function refreshDetail(detail: GalleryAlbumDetail) {
  selected.value = detail
}

// ---------------------------------------------------------------------------
// Image upload / delete
// ---------------------------------------------------------------------------

const uploadFile = ref<File | null>(null)
const uploadCaption = ref('')
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
  form.append('file', file)
  form.append('caption', uploadCaption.value.trim())
  try {
    refreshDetail(await galleryApi.uploadImage(selected.value.id, form))
    uploadFile.value = null
    uploadCaption.value = ''
    await loadAlbums()
  } catch (e) {
    uploadError.value = formatApiError(e)
  } finally {
    uploading.value = false
  }
}

async function deleteImage(image: GalleryImage) {
  if (!selected.value) return
  if (!window.confirm(`Delete image "${image.fileName}"?`)) return
  try {
    refreshDetail(
      await galleryApi.deleteImage(selected.value.id, image.id),
    )
    await loadAlbums()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Gallery</h1>
        <p class="mt-1 text-sm text-gray-500">
          Photo albums and images from school events.
        </p>
      </div>
      <button
        v-if="canManage"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreateAlbum"
      >
        New album
      </button>
    </div>

    <p
      v-if="notice"
      class="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
      @click="notice = null"
    >
      {{ notice }}
    </p>
    <p v-if="loadError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ loadError }}
    </p>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
    <div
      v-else-if="albums.length === 0"
      class="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500"
    >
      No albums found.
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="album in albums"
        :key="album.id"
        class="flex flex-col rounded-lg border border-gray-200 bg-white p-4"
      >
        <button
          class="text-left text-base font-semibold text-gray-900 hover:underline"
          @click="openDetail(album)"
        >
          {{ album.title }}
        </button>
        <p v-if="album.description" class="mt-1 text-sm text-gray-500">
          {{ album.description }}
        </p>
        <dl class="mt-3 space-y-1 text-xs text-gray-400">
          <div>{{ album.imageCount }} image(s)</div>
          <div v-if="album.eventName">Event: {{ album.eventName }}</div>
        </dl>
        <div v-if="canManage" class="mt-4 flex gap-3 text-xs">
          <button class="text-gray-600 hover:underline" @click="openEditAlbum(album)">
            Edit
          </button>
          <button class="text-red-700 hover:underline" @click="deleteAlbum(album)">
            Delete
          </button>
        </div>
      </div>
    </div>

    <div v-if="total > 0" class="flex items-center justify-between text-sm text-gray-600">
      <span>{{ total }} album(s) · page {{ page }} of {{ lastPage }}</span>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page--; void loadAlbums()"
        >
          Previous
        </button>
        <button
          :disabled="page >= lastPage"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page++; void loadAlbums()"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Album create / edit -->
    <BaseModal
      :open="albumModalOpen"
      :title="editingAlbumId ? 'Edit album' : 'New album'"
      @close="albumModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitAlbumForm">
        <p v-if="albumError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ albumError }}
        </p>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Title *</span>
          <input
            v-model="albumForm.title"
            required
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Description</span>
          <textarea
            v-model="albumForm.description"
            rows="3"
            maxlength="5000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Event ID (optional)</span>
          <input
            v-model="albumForm.eventId"
            maxlength="36"
            placeholder="UUID of a school event"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="albumForm.isPublished" type="checkbox" />
          Published
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            @click="albumModalOpen = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="albumSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ albumSaving ? 'Saving…' : 'Save album' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Album detail -->
    <BaseModal
      :open="detailOpen"
      :title="selected ? selected.title : 'Album'"
      wide
      @close="detailOpen = false"
    >
      <div v-if="detailLoading" class="text-sm text-gray-500">Loading…</div>
      <div v-else-if="selected" class="space-y-6">
        <div class="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{{ selected.images.length }} image(s)</span>
          <span v-if="selected.eventName"> · {{ selected.eventName }}</span>
        </div>

        <div v-if="selected.images.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div
            v-for="image in selected.images"
            :key="image.id"
            class="overflow-hidden rounded-md border border-gray-200 bg-gray-50"
          >
            <img
              :src="galleryApi.imageUrl(selected.id, image.id)"
              :alt="image.caption || image.fileName"
              loading="lazy"
              class="h-32 w-full object-cover"
            />
            <div class="p-2 text-xs">
              <p class="truncate font-medium text-gray-800">{{ image.fileName }}</p>
              <p v-if="image.caption" class="text-gray-500">{{ image.caption }}</p>
              <p v-if="image.sizeBytes" class="text-gray-400">
                {{ fmtBytes(image.sizeBytes) }} · {{ fmtDate(image.createdAt) }}
              </p>
              <div class="mt-2 flex gap-3">
                <a
                  :href="galleryApi.imageUrl(selected.id, image.id)"
                  target="_blank"
                  class="font-medium text-indigo-700 hover:underline"
                >
                  Download
                </a>
                <button
                  v-if="canManage"
                  class="text-red-700 hover:underline"
                  @click="deleteImage(image)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400">No images in this album yet.</p>

        <div v-if="canManage" class="border-t border-gray-100 pt-4">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Upload image
          </h3>
          <div class="flex flex-wrap items-end gap-3">
            <input type="file" class="text-sm" @change="onFileChange" />
            <label class="block text-sm">
              <span class="block text-xs font-medium text-gray-500">Caption</span>
              <input
                v-model="uploadCaption"
                maxlength="500"
                class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              :disabled="uploading"
              class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              @click="submitUpload"
            >
              {{ uploading ? 'Uploading…' : 'Upload' }}
            </button>
            <p v-if="uploadError" class="w-full text-sm text-red-700">{{ uploadError }}</p>
          </div>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
