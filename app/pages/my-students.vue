<script setup lang="ts">
/**
 * Teacher self-service: my students roster (README §17, Phase 7).
 * Lists active students enrolled in the caller's assigned classes.
 * Optional ?classId narrows the list to one of the teacher's classes;
 * the service refuses unknown classIds silently (empty result) so we
 * don't leak which classes exist. Search matches name/admission number.
 */
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type { TeacherStudentRow } from '~/shared/types'

definePageMeta({ permissions: ['students.view'] })

useHead({ title: 'My Students — Teacher' })

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<TeacherStudentRow[]>([])
const total = ref(0)
const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
const perPage = ref(20)
const search = ref(String(route.query.search ?? ''))
const classId = ref(String(route.query.classId ?? ''))

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const res = await teachersApi.listMyStudents({
      page: page.value,
      perPage: perPage.value,
      order: 'asc',
      search: search.value.trim() || undefined,
      classId: classId.value || undefined,
    })
    rows.value = res.data
    total.value = res.meta.total
  } catch (e) {
    rows.value = []
    total.value = 0
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

const lastPage = computed(() =>
  Math.max(1, Math.ceil(total.value / perPage.value)),
)

function applySearch() {
  page.value = 1
  void router.replace({
    query: {
      ...(classId.value ? { classId: classId.value } : {}),
      ...(search.value ? { search: search.value } : {}),
    },
  })
  void load()
}

function clearFilters() {
  search.value = ''
  classId.value = ''
  applySearch()
}

function goto(p: number) {
  if (p < 1 || p > lastPage.value) return
  page.value = p
  void router.replace({
    query: {
      ...(classId.value ? { classId: classId.value } : {}),
      ...(search.value ? { search: search.value } : {}),
      page: String(p),
    },
  })
  void load()
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">My Students</h1>
      <p class="mt-1 text-sm text-gray-500">
        Roster of students in the classes you teach.
      </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
      <input
        v-model="search"
        type="search"
        placeholder="Search name or admission number…"
        class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        @keydown.enter.prevent="applySearch"
      />
      <button
        type="button"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        @click="applySearch"
      >
        Search
      </button>
      <button
        v-if="search || classId"
        type="button"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        @click="clearFilters"
      >
        Clear
      </button>
    </div>

    <div
      v-if="loading"
      class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600"
    >
      Loading students…
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
      No students match the current filter.
    </div>
    <div v-else class="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Admission #</th>
            <th class="px-4 py-3 text-left font-medium">Name</th>
            <th class="px-4 py-3 text-left font-medium">Class</th>
            <th class="px-4 py-3 text-left font-medium">Section</th>
            <th class="px-4 py-3 text-left font-medium">Guardian</th>
            <th class="px-4 py-3 text-left font-medium">Phone</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="s in rows"
            :key="s.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3 text-gray-700">{{ s.admissionNumber }}</td>
            <td class="px-4 py-3 font-medium text-gray-900">
              {{ s.firstName }} {{ s.lastName }}
            </td>
            <td class="px-4 py-3 text-gray-700">{{ s.className || '—' }}</td>
            <td class="px-4 py-3 text-gray-700">{{ s.sectionName || '—' }}</td>
            <td class="px-4 py-3 text-gray-700">{{ s.guardianName || '—' }}</td>
            <td class="px-4 py-3 text-gray-700">{{ s.guardianPhone || '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div
        class="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600"
      >
        <p>
          Showing
          <span class="font-medium text-gray-900">{{ rows.length }}</span>
          of
          <span class="font-medium text-gray-900">{{ total }}</span>
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
            :disabled="page <= 1"
            @click="goto(page - 1)"
          >
            Previous
          </button>
          <span class="px-2 py-1.5">Page {{ page }} of {{ lastPage }}</span>
          <button
            type="button"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
            :disabled="page >= lastPage"
            @click="goto(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
