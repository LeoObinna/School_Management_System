<script setup lang="ts">
/**
 * Teacher portal — multi-subject CSV score upload (Phase 16D).
 * The file is parsed client-side (shared/utils/csv) and sent to
 * POST /exam-results/bulk-preview for per-row validation; only valid
 * rows are committed by POST /exam-results/bulk. Manual entry remains
 * available on the existing /exam-results page.
 */
import { examsApi } from '~/services/exams'
import { formatApiError } from '~/utils/errors'
import { parseScoreCsv, type ScoreCsvRow } from '~/shared/utils/csv'
import type {
  ExamDetail,
  ExamListItem,
  ExamScoreBulkResult,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['exam_results.enter'] })

const exams = ref<ExamListItem[]>([])
const selectedExamId = ref('')
const examDetail = ref<ExamDetail | null>(null)

const fileName = ref('')
const parsedRows = ref<ScoreCsvRow[]>([])
const parseErrors = ref<string[]>([])

const preview = ref<ExamScoreBulkResult | null>(null)
const previewLoading = ref(false)
const committing = ref(false)
const error = ref<string | null>(null)
const committedMessage = ref<string | null>(null)
const loading = ref(true)

async function loadExams() {
  try {
    // Only open exams accept score entry; the server scopes the list
    // to the caller's assigned classes.
    const page = await examsApi.listExams({
      status: 'open',
      perPage: 100,
    })
    exams.value = page.data
    selectedExamId.value = exams.value[0]?.id ?? ''
    if (selectedExamId.value) await loadExamDetail()
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function loadExamDetail() {
  examDetail.value = null
  if (!selectedExamId.value) return
  try {
    examDetail.value = await examsApi.getExam(selectedExamId.value)
  } catch (e) {
    error.value = formatApiError(e)
  }
}

watch(selectedExamId, () => {
  clearFile()
  preview.value = null
  committedMessage.value = null
  loadExamDetail()
})

function clearFile() {
  fileName.value = ''
  parsedRows.value = []
  parseErrors.value = []
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  clearFile()
  preview.value = null
  committedMessage.value = null
  if (!file) return
  fileName.value = file.name
  try {
    const text = await file.text()
    const result = parseScoreCsv(text)
    parsedRows.value = result.rows
    parseErrors.value = result.errors
  } catch {
    parseErrors.value = ['The file could not be read as text.']
  }
}

const canPreview = computed(
  () =>
    Boolean(selectedExamId.value) &&
    parsedRows.value.length > 0 &&
    parseErrors.value.length === 0,
)

async function runPreview() {
  if (!canPreview.value) return
  previewLoading.value = true
  error.value = null
  committedMessage.value = null
  try {
    preview.value = await examsApi.bulkPreviewExamScores({
      examId: selectedExamId.value,
      rows: parsedRows.value,
    })
  } catch (e) {
    error.value = formatApiError(e)
    preview.value = null
  } finally {
    previewLoading.value = false
  }
}

const canCommit = computed(
  () => preview.value !== null && preview.value.summary.valid > 0,
)

async function runCommit() {
  if (!canCommit.value) return
  committing.value = true
  error.value = null
  try {
    const result = await examsApi.bulkCommitExamScores({
      examId: selectedExamId.value,
      rows: parsedRows.value,
    })
    preview.value = result
    committedMessage.value = `Committed ${result.committed} score${result.committed === 1 ? '' : 's'} to ${result.exam.name}.`
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    committing.value = false
  }
}

function downloadTemplate() {
  const subjects = examDetail.value?.subjects ?? []
  const lines = ['admission_number,subject_code,score']
  for (const subject of subjects) {
    if (subject.subjectCode) {
      lines.push(`VCS/0001,${subject.subjectCode},75`)
    }
  }
  const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'scores-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(loadExams)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-semibold text-text-primary">
          Exam scores
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Upload scores for several subjects at once, or
          <NuxtLink
            to="/exam-results/enter"
            class="font-medium text-brand-primary underline underline-offset-2"
          >
            enter them manually
          </NuxtLink>
          .
        </p>
      </div>
      <label v-if="exams.length > 1" class="text-sm">
        <span class="mr-2 text-text-muted">Exam</span>
        <select
          v-model="selectedExamId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option v-for="exam in exams" :key="exam.id" :value="exam.id">
            {{ exam.name }} — {{ exam.className }}
          </option>
        </select>
      </label>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading exams…
    </div>

    <template v-else>
      <p
        v-if="exams.length === 0"
        class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      >
        No open exams accept score entry right now.
      </p>

      <template v-else>
        <p
          v-if="error"
          class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
          role="alert"
        >
          {{ error }}
        </p>

        <!-- Step 1: pick file -->
        <section class="rounded-xl border border-border-default bg-surface p-6">
          <h2 class="font-display text-lg font-semibold text-text-primary">
            1. Choose a CSV file
          </h2>
          <p class="mt-1 text-sm text-text-secondary">
            Required columns:
            <code class="rounded bg-surface-muted px-1">admission_number</code>,
            <code class="rounded bg-surface-muted px-1">subject_code</code>,
            <code class="rounded bg-surface-muted px-1">score</code>.
            <button
              type="button"
              class="ml-1 font-medium text-brand-primary underline underline-offset-2"
              :disabled="!examDetail"
              @click="downloadTemplate"
            >
              Download a template
            </button>
            for this exam.
          </p>
          <ul
            v-if="(examDetail?.subjects ?? []).length > 0"
            class="mt-3 flex flex-wrap gap-2"
          >
            <li
              v-for="subject in examDetail!.subjects"
              :key="subject.subjectId"
              class="rounded-full bg-surface-muted px-3 py-1 text-xs text-text-secondary"
            >
              {{ subject.subjectName }}
              <span class="font-medium text-text-primary">
                {{ subject.subjectCode ?? 'no code' }}
              </span>
            </li>
          </ul>
          <input
            type="file"
            accept=".csv,text/csv"
            class="mt-4 block w-full max-w-md rounded-md border border-border-default bg-surface text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-inverse"
            @change="onFileChange"
          />
          <p v-if="fileName" class="mt-2 text-sm text-text-secondary">
            {{ fileName }} — {{ parsedRows.length }} row{{
              parsedRows.length === 1 ? '' : 's'
          }}
            parsed.
          </p>
          <ul
            v-if="parseErrors.length > 0"
            class="mt-3 list-inside list-disc rounded-lg bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            <li v-for="parseError in parseErrors" :key="parseError">
              {{ parseError }}
            </li>
          </ul>
        </section>

        <!-- Step 2: preview -->
        <section class="rounded-xl border border-border-default bg-surface p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-lg font-semibold text-text-primary">
              2. Preview &amp; commit
            </h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-border-default px-4 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canPreview || previewLoading"
                @click="runPreview"
              >
                {{ previewLoading ? 'Checking…' : 'Check rows' }}
              </button>
              <button
                v-if="preview"
                type="button"
                class="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canCommit || committing"
                @click="runCommit"
              >
                {{
                  committing
                    ? 'Saving…'
                    : `Commit ${preview.summary.valid} valid row${preview.summary.valid === 1 ? '' : 's'}`
                }}
              </button>
            </div>
          </div>

          <p
            v-if="committedMessage"
            class="mt-3 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800"
            role="status"
          >
            {{ committedMessage }}
          </p>

          <template v-if="preview">
            <p class="mt-3 text-sm text-text-secondary">
              {{ preview.summary.total }} row{{
                preview.summary.total === 1 ? '' : 's'
              }}:
              <span class="font-medium text-green-800">
                {{ preview.summary.valid }} valid
              </span>
              /
              <span class="font-medium text-red-800">
                {{ preview.summary.invalid }} with errors
              </span>
            </p>
            <div
              class="mt-3 overflow-x-auto rounded-lg border border-border-default"
            >
              <table class="w-full min-w-[720px] text-sm">
                <thead>
                  <tr
                    class="border-b border-border-default bg-surface-muted text-left text-text-muted"
                  >
                    <th class="px-3 py-2 font-medium">#</th>
                    <th class="px-3 py-2 font-medium">Admission</th>
                    <th class="px-3 py-2 font-medium">Subject</th>
                    <th class="px-3 py-2 font-medium">Score</th>
                    <th class="px-3 py-2 font-medium">Student</th>
                    <th class="px-3 py-2 font-medium">Grade</th>
                    <th class="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in preview.rows"
                    :key="row.rowNumber"
                    class="border-b border-border-default last:border-0"
                    :class="row.ok ? 'bg-green-50/60' : 'bg-red-50/60'"
                  >
                    <td class="px-3 py-2 text-text-muted">{{ row.rowNumber }}</td>
                    <td class="px-3 py-2 text-text-primary">
                      {{ row.admissionNumber }}
                    </td>
                    <td class="px-3 py-2 text-text-primary">
                      {{ row.subjectCode }}
                    </td>
                    <td class="px-3 py-2 text-text-primary">{{ row.score }}</td>
                    <td class="px-3 py-2 text-text-secondary">
                      {{ row.studentName ?? '—' }}
                    </td>
                    <td class="px-3 py-2 text-text-secondary">
                      {{ row.grade ?? '—' }}
                    </td>
                    <td class="px-3 py-2">
                      <span
                        v-if="row.ok"
                        class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                      >
                        OK
                      </span>
                      <span
                        v-else
                        class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                      >
                        {{ row.error }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          <p
            v-else-if="!previewLoading"
            class="mt-3 text-sm text-text-muted"
          >
            Check the rows before committing — only valid rows are saved, and
            uploading again for the same student + subject overwrites the
            earlier score.
          </p>
        </section>
      </template>
    </template>
  </div>
</template>
