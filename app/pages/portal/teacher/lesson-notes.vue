<script setup lang="ts">
/**
 * Teacher portal — lesson notes (Phase 16D): text notes with optional
 * R2 attachments, scoped to the calling teacher (admins manage all).
 */
import { academicsApi } from '~/services/academics'
import { teachersApi } from '~/services/teachers'
import { lessonNotesApi } from '~/services/lesson-notes'
import { useAuthStore } from '~/stores/auth'
import { formatApiError } from '~/utils/errors'
import type {
  AcademicSession,
  LessonNoteDetail,
  TeacherClassAssignmentDetail,
  Term,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['lesson_notes.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('lesson_notes.manage'))

const sessions = ref<AcademicSession[]>([])
const assignments = ref<TeacherClassAssignmentDetail[]>([])
const terms = ref<Term[]>([])
const notes = ref<LessonNoteDetail[]>([])

const filterSessionId = ref('')
const filterClassId = ref('')

const loading = ref(true)
const error = ref<string | null>(null)

// --- Load filter options ----------------------------------------------------
async function loadOptions() {
  const [sessPage, classRes] = await Promise.all([
    academicsApi.listSessions({ perPage: 100 }),
    teachersApi.listMyClasses(),
  ])
  sessions.value = sessPage.data
  assignments.value = classRes.data
  filterSessionId.value =
    sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
}

const classOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const a of assignments.value) {
    if (a.sessionId === filterSessionId.value && !seen.has(a.classId)) {
      seen.set(a.classId, a.className)
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }))
})

// --- List -------------------------------------------------------------------
async function loadNotes() {
  error.value = null
  try {
    const res = await lessonNotesApi.list({
      sessionId: filterSessionId.value || undefined,
      classId: filterClassId.value || undefined,
    })
    notes.value = res.data
  } catch (e) {
    error.value = formatApiError(e)
  }
}

watch([filterSessionId, filterClassId], loadNotes)

// --- Editor -----------------------------------------------------------------
const editorOpen = ref(false)
const editing = ref<LessonNoteDetail | null>(null)
const saving = ref(false)
const editorError = ref<string | null>(null)
const form = reactive({
  sessionId: '',
  classId: '',
  subjectId: '',
  termId: '',
  week: '',
  title: '',
  content: '',
})

const subjectOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const a of assignments.value) {
    if (
      a.sessionId === form.sessionId &&
      a.classId === form.classId &&
      !seen.has(a.subjectId)
    ) {
      seen.set(a.subjectId, a.subjectName)
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }))
})

// Class options inside the editor follow the form's session (not the
// list filter).
const formClassOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const a of assignments.value) {
    if (a.sessionId === form.sessionId && !seen.has(a.classId)) {
      seen.set(a.classId, a.className)
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }))
})

// Terms follow the form's session. Subject/class clearing happens in
// explicit @change handlers so editing an existing note keeps its
// prefilled selections.
watch(
  () => form.sessionId,
  async (sessionId) => {
    if (sessionId) {
      try {
        const page = await academicsApi.listTerms({
          sessionId,
          perPage: 50,
        })
        terms.value = page.data
      } catch {
        terms.value = []
      }
    } else {
      terms.value = []
    }
  },
)

function onFormSessionChange() {
  form.classId = ''
  form.subjectId = ''
}

function onFormClassChange() {
  form.subjectId = ''
}

function openCreate() {
  editing.value = null
  editorError.value = null
  Object.assign(form, {
    sessionId: filterSessionId.value,
    classId: filterClassId.value,
    subjectId: '',
    termId: '',
    week: '',
    title: '',
    content: '',
  })
  editorOpen.value = true
}

function openEdit(note: LessonNoteDetail) {
  editing.value = note
  editorError.value = null
  Object.assign(form, {
    sessionId: note.sessionId,
    classId: note.classId,
    subjectId: note.subjectId,
    termId: note.termId ?? '',
    week: note.week ? String(note.week) : '',
    title: note.title,
    content: note.content,
  })
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

async function submitEditor() {
  saving.value = true
  editorError.value = null
  const body = {
    sessionId: form.sessionId,
    classId: form.classId,
    subjectId: form.subjectId,
    ...(form.termId ? { termId: form.termId } : { termId: null }),
    ...(form.week ? { week: Number(form.week) } : { week: null }),
    title: form.title,
    content: form.content,
  }
  try {
    if (editing.value) {
      await lessonNotesApi.update(editing.value.id, body)
    } else {
      await lessonNotesApi.create(body)
    }
    editorOpen.value = false
    await loadNotes()
  } catch (e) {
    editorError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function removeNote(note: LessonNoteDetail) {
  if (!confirm(`Delete "${note.title}" and its attachments?`)) return
  try {
    await lessonNotesApi.remove(note.id)
    await loadNotes()
  } catch (e) {
    error.value = formatApiError(e)
  }
}

// --- Attachments ------------------------------------------------------------
const uploadingNoteId = ref<string | null>(null)

async function onFilePicked(note: LessonNoteDetail, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadingNoteId.value = note.id
  error.value = null
  try {
    const form = new FormData()
    form.append('file', file)
    await lessonNotesApi.uploadFile(note.id, form)
    await loadNotes()
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    uploadingNoteId.value = null
  }
}

async function removeAttachment(note: LessonNoteDetail, fileId: string) {
  if (!confirm('Remove this attachment?')) return
  error.value = null
  try {
    await lessonNotesApi.removeFile(note.id, fileId)
    await loadNotes()
  } catch (e) {
    error.value = formatApiError(e)
  }
}

function formatBytes(size: number | null): string {
  if (size === null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

onMounted(async () => {
  try {
    await loadOptions()
    await loadNotes()
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-semibold text-text-primary">
          Lesson notes
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Write weekly notes and attach worksheets for your classes.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse"
        @click="openCreate"
      >
        New note
      </button>
    </header>

    <p
      v-if="error"
      class="rounded-xl border border-border-default bg-surface p-4 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </p>

    <div class="flex flex-wrap gap-3">
      <label class="text-sm">
        <span class="mr-2 text-text-muted">Session</span>
        <select
          v-model="filterSessionId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option v-for="session in sessions" :key="session.id" :value="session.id">
            {{ session.name }}
          </option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mr-2 text-text-muted">Class</span>
        <select
          v-model="filterClassId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">All my classes</option>
          <option v-for="option in classOptions" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
      </label>
    </div>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading notes…
    </div>

    <p
      v-else-if="notes.length === 0"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      No lesson notes yet for this selection.
    </p>

    <ul v-else class="space-y-4">
      <li
        v-for="note in notes"
        :key="note.id"
        class="rounded-xl border border-border-default bg-surface p-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-semibold text-text-primary">
              {{ note.title }}
            </h2>
            <p class="mt-1 text-sm text-text-secondary">
              {{ note.className }} · {{ note.subjectName }}
              <template v-if="note.week"> · Week {{ note.week }}</template>
              <template v-if="note.termName"> · {{ note.termName }}</template>
              · {{ note.sessionName }}
            </p>
            <p class="mt-0.5 text-xs text-text-muted">
              Updated {{ new Date(note.updatedAt).toLocaleDateString() }}
            </p>
          </div>
          <div class="flex gap-2">
            <button
              v-if="canManage"
              type="button"
              class="rounded-md border border-border-default px-3 py-1.5 text-sm font-medium text-text-primary"
              @click="openEdit(note)"
            >
              Edit
            </button>
            <button
              v-if="canManage"
              type="button"
              class="rounded-md border border-border-default px-3 py-1.5 text-sm font-medium text-brand-emphasis"
              @click="removeNote(note)"
            >
              Delete
            </button>
          </div>
        </div>

        <p class="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
          {{ note.content }}
        </p>

        <div v-if="note.files.length > 0" class="mt-4 space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Attachments
          </h3>
          <ul class="space-y-1">
            <li
              v-for="file in note.files"
              :key="file.id"
              class="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2 text-sm"
            >
              <a
                :href="lessonNotesApi.fileDownloadUrl(note.id, file.id)"
                class="truncate text-brand-primary underline underline-offset-2"
                :download="file.fileName"
              >
                {{ file.fileName }}
              </a>
              <span class="shrink-0 text-xs text-text-muted">
                {{ formatBytes(file.sizeBytes) }}
                <button
                  type="button"
                  class="ml-2 font-medium text-brand-emphasis hover:underline"
                  @click="removeAttachment(note, file.id)"
                >
                  Remove
                </button>
              </span>
            </li>
          </ul>
        </div>

        <label
          v-if="canManage"
          class="mt-4 inline-block cursor-pointer text-sm font-medium text-brand-primary underline underline-offset-2"
        >
          {{ uploadingNoteId === note.id ? 'Uploading…' : 'Attach a file' }}
          <input
            type="file"
            class="hidden"
            :disabled="uploadingNoteId === note.id"
            @change="onFilePicked(note, $event)"
          />
        </label>
      </li>
    </ul>

    <!-- Editor overlay -->
    <div
      v-if="editorOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      @keydown.escape="closeEditor"
    >
      <div class="my-8 w-full max-w-2xl rounded-xl bg-surface p-6 shadow-lg">
        <h2 class="font-display text-xl font-semibold text-text-primary">
          {{ editing ? 'Edit lesson note' : 'New lesson note' }}
        </h2>
        <p
          v-if="editorError"
          class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {{ editorError }}
        </p>

        <form class="mt-4 space-y-4" @submit.prevent="submitEditor">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="text-sm">
              <span class="mb-1 block text-text-muted">Session</span>
              <select
                v-model="form.sessionId"
                required
                class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
                @change="onFormSessionChange"
              >
                <option value="" disabled>Select session</option>
                <option v-for="session in sessions" :key="session.id" :value="session.id">
                  {{ session.name }}
                </option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block text-text-muted">Class</span>
              <select
                v-model="form.classId"
                required
                class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
                @change="onFormClassChange"
              >
                <option value="" disabled>Select class</option>
                <option v-for="option in formClassOptions" :key="option.id" :value="option.id">
                  {{ option.name }}
                </option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block text-text-muted">Subject</span>
              <select
                v-model="form.subjectId"
                required
                class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
              >
                <option value="" disabled>Select subject</option>
                <option v-for="option in subjectOptions" :key="option.id" :value="option.id">
                  {{ option.name }}
                </option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block text-text-muted">Term (optional)</span>
              <select
                v-model="form.termId"
                class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option v-for="term in terms" :key="term.id" :value="term.id">
                  {{ term.name }}
                </option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1 block text-text-muted">Week (optional)</span>
              <input
                v-model="form.week"
                type="number"
                min="1"
                max="52"
                class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label class="text-sm sm:col-span-2">
              <span class="mb-1 block text-text-muted">Title</span>
              <input
                v-model="form.title"
                required
                maxlength="200"
                class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label class="block text-sm">
            <span class="mb-1 block text-text-muted">Content</span>
            <textarea
              v-model="form.content"
              required
              rows="8"
              maxlength="20000"
              class="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-sm"
            />
          </label>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-primary"
              @click="closeEditor"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving || !form.sessionId || !form.classId || !form.subjectId"
              class="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ saving ? 'Saving…' : 'Save note' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
