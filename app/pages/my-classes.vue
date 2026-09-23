<script setup lang="ts">
/**
 * Teacher self-service: classes I teach (README §17, Phase 7).
 * Lists the caller's teacher_class_assignments via the
 * /teacher-assignments/me endpoint, which resolves the teacherId
 * server-side and reuses the admin listTeacherClassAssignments shape.
 * Each row links through to /my-students?classId=… so the teacher can
 * jump straight into the roster for that class.
 */
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type { TeacherClassAssignmentDetail } from '~/shared/types'

definePageMeta({ permissions: ['teachers.view'] })

useHead({ title: 'My Classes — Teacher' })

const loading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<TeacherClassAssignmentDetail[]>([])

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const res = await teachersApi.listMyClasses()
    rows.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">My Classes</h1>
      <p class="mt-1 text-sm text-gray-500">
        Classes, sections and subjects assigned to you this session.
      </p>
    </div>

    <div
      v-if="loading"
      class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600"
    >
      Loading your classes…
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
      You have no class assignments yet. Contact an administrator if you believe this is an error.
    </div>
    <div v-else class="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Class</th>
            <th class="px-4 py-3 text-left font-medium">Section</th>
            <th class="px-4 py-3 text-left font-medium">Subject</th>
            <th class="px-4 py-3 text-left font-medium">Session</th>
            <th class="px-4 py-3 text-left font-medium">Role</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in rows"
            :key="row.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3 font-medium text-gray-900">{{ row.className }}</td>
            <td class="px-4 py-3 text-gray-700">
              {{ row.sectionName || '—' }}
            </td>
            <td class="px-4 py-3 text-gray-700">{{ row.subjectName }}</td>
            <td class="px-4 py-3 text-gray-700">{{ row.sessionName }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  row.isPrimaryTeacher
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-100 text-gray-700'
                "
              >
                {{ row.isPrimaryTeacher ? 'Primary' : 'Secondary' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <NuxtLink
                :to="{ path: '/my-students', query: { classId: row.classId } }"
                class="text-indigo-600 hover:underline text-sm"
              >
                View roster →
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
