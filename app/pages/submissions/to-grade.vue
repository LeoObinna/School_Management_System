<script setup lang="ts">
/**
 * Teacher self-service: submissions to grade (README §17, Phase 7).
 * Lists the caller's assignments that still have at least one
 * submission awaiting review (status submitted/late by default).
 * Each row links to the existing /assignments/[id] grading view.
 */
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type { TeacherAssignmentToGradeRow } from '~/shared/types'

definePageMeta({ permissions: ['submissions.view'] })

useHead({ title: 'Submissions to Grade — Teacher' })

const router = useRouter()

const loading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<TeacherAssignmentToGradeRow[]>([])

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const res = await teachersApi.listSubmissionsToGrade()
    rows.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

function formatDue(value: string | null) {
  if (!value) return 'No due date'
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function openAssignment(id: string) {
  void router.push(`/assignments/${id}`)
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">Submissions to Grade</h1>
      <p class="mt-1 text-sm text-gray-500">
        Assignments you own with at least one submission awaiting review.
      </p>
    </div>

    <div
      v-if="loading"
      class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600"
    >
      Loading your queue…
    </div>
    <div
      v-else-if="loadError"
      class="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700"
    >
      {{ loadError }}
      <button class="ml-2 underline" @click="load">Retry</button>
    </div>
    <div
      v-else-if="!rows.length"
      class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600"
    >
      You have no submissions waiting to be graded.
    </div>
    <div v-else class="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Assignment</th>
            <th class="px-4 py-3 text-left font-medium">Class</th>
            <th class="px-4 py-3 text-left font-medium">Section</th>
            <th class="px-4 py-3 text-left font-medium">Subject</th>
            <th class="px-4 py-3 text-left font-medium">Due</th>
            <th class="px-4 py-3 text-right font-medium">Pending</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in rows"
            :key="row.assignmentId"
            class="hover:bg-gray-50 cursor-pointer"
            @click="openAssignment(row.assignmentId)"
          >
            <td class="px-4 py-3 font-medium text-gray-900">{{ row.title }}</td>
            <td class="px-4 py-3 text-gray-700">{{ row.className }}</td>
            <td class="px-4 py-3 text-gray-700">{{ row.sectionName || '—' }}</td>
            <td class="px-4 py-3 text-gray-700">{{ row.subjectName }}</td>
            <td class="px-4 py-3 text-gray-700">{{ formatDue(row.dueDate) }}</td>
            <td class="px-4 py-3 text-right">
              <span
                class="inline-flex rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium"
              >
                {{ row.pendingCount }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
