<script setup lang="ts">
/**
 * Teacher portal — class performance (Phase 16C). Aggregates come from
 * GET /api/v1/teachers/me/performance: per (exam, subject) averages,
 * extremes and grade distribution, built only from scores covered by a
 * published result_publications row.
 */
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type {
  TeacherClassAssignmentDetail,
  TeacherPerformanceRow,
} from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['exam_results.view'] })

const assignments = ref<TeacherClassAssignmentDetail[]>([])
const selectedClassId = ref('')
const rows = ref<TeacherPerformanceRow[]>([])
const loading = ref(true)
const listLoading = ref(false)
const error = ref<string | null>(null)

const classOptions = computed(() => {
  const seen = new Set<string>()
  return assignments.value.filter((a) => {
    if (seen.has(a.classId)) return false
    seen.add(a.classId)
    return true
  })
})

async function loadPerformance() {
  if (!selectedClassId.value) {
    rows.value = []
    return
  }
  listLoading.value = true
  try {
    rows.value = await teachersApi.getPerformance({
      classId: selectedClassId.value,
    })
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    listLoading.value = false
  }
}

watch(selectedClassId, loadPerformance)

onMounted(async () => {
  try {
    const res = await teachersApi.listMyClasses({ page: 1, perPage: 200 })
    assignments.value = res.data
    selectedClassId.value = classOptions.value[0]?.classId ?? ''
    if (selectedClassId.value) await loadPerformance()
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
          Performance
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Published exam scores only — drafts stay private until results are
          published.
        </p>
      </div>
      <label v-if="classOptions.length > 1" class="text-sm">
        <span class="mr-2 text-text-muted">Class</span>
        <select
          v-model="selectedClassId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option v-for="a in classOptions" :key="a.classId" :value="a.classId">
            {{ a.className }}
          </option>
        </select>
      </label>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading performance…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <p
      v-else-if="classOptions.length === 0"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      You have no class assignments yet.
    </p>

    <template v-else>
      <p v-if="listLoading" class="text-sm text-text-muted" role="status">
        Loading aggregates…
      </p>
      <p
        v-else-if="rows.length === 0"
        class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      >
        No published scores for this class yet.
      </p>
      <section
        v-else
        class="overflow-hidden rounded-xl border border-border-default bg-surface"
      >
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border-default bg-surface-muted text-left text-text-muted">
              <th class="px-4 py-3 font-medium">Exam</th>
              <th class="px-4 py-3 font-medium">Subject</th>
              <th class="px-4 py-3 text-right font-medium">Students</th>
              <th class="px-4 py-3 text-right font-medium">Average</th>
              <th class="px-4 py-3 text-right font-medium">High / Low</th>
              <th class="px-4 py-3 font-medium">Grades</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="`${row.examId}:${row.subjectId}`"
              class="border-b border-border-default last:border-0"
            >
              <td class="px-4 py-3 text-text-primary">{{ row.examName }}</td>
              <td class="px-4 py-3 text-text-primary">{{ row.subjectName }}</td>
              <td class="px-4 py-3 text-right text-text-secondary">
                {{ row.studentCount }}
              </td>
              <td class="px-4 py-3 text-right font-medium text-text-primary">
                {{ row.averageScore }} / {{ row.maxScore }}
              </td>
              <td class="px-4 py-3 text-right text-text-secondary">
                {{ row.highestScore }} / {{ row.lowestScore }}
              </td>
              <td class="px-4 py-3">
                <span
                  v-for="dist in row.gradeDistribution"
                  :key="dist.grade"
                  class="mr-1 inline-block rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary"
                >
                  {{ dist.grade }}: {{ dist.count }}
                </span>
                <span
                  v-if="row.gradeDistribution.length === 0"
                  class="text-xs text-text-muted"
                >
                  —
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
