<script setup lang="ts">
/**
 * Parent portal — published report cards with PDF download (Phase 16B).
 * Reuses the existing scoped endpoint
 * GET /api/v1/students/[studentId]/report-cards (parents can only fetch
 * their own children's cards; the PDF route re-checks access).
 */
import { examsApi } from '~/services/exams'
import { formatApiError } from '~/utils/errors'
import type { MySchoolContext, ReportCardDetail } from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['report_cards.view'] })

const ctx = ref<MySchoolContext | null>(null)
const selectedId = ref<string | null>(null)
const cards = ref<ReportCardDetail[]>([])
const loading = ref(true)
const listLoading = ref(false)
const error = ref<string | null>(null)

const children = computed(() => ctx.value?.children ?? [])
const selectedChild = computed(() =>
  children.value.find((c) => c.id === selectedId.value),
)

async function loadCards() {
  if (!selectedId.value) {
    cards.value = []
    return
  }
  listLoading.value = true
  try {
    const res = await examsApi.listStudentReportCards(selectedId.value)
    cards.value = res.data
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    listLoading.value = false
  }
}

watch(selectedId, loadCards)

onMounted(async () => {
  try {
    ctx.value = await examsApi.getMySchoolContext()
    selectedId.value = ctx.value.children[0]?.id ?? null
    if (selectedId.value) await loadCards()
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
          Report cards
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Published report cards; PDF download once released by the school.
        </p>
      </div>
      <label v-if="children.length > 1" class="text-sm">
        <span class="mr-2 text-text-muted">Child</span>
        <select
          v-model="selectedId"
          class="rounded-md border border-border-default bg-surface px-3 py-1.5 text-sm"
        >
          <option v-for="child in children" :key="child.id" :value="child.id">
            {{ child.name }}
          </option>
        </select>
      </label>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading report cards…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <p
      v-else-if="children.length === 0"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
    >
      No children are linked to your account yet.
    </p>

    <template v-else>
      <p
        v-if="listLoading"
        class="text-sm text-text-muted"
        role="status"
      >
        Loading cards…
      </p>
      <p
        v-else-if="cards.length === 0"
        class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      >
        No report cards published for
        {{ selectedChild?.name ?? 'this child' }} yet.
      </p>
      <ul v-else class="space-y-3">
        <li
          v-for="card in cards"
          :key="card.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface p-5"
        >
          <div>
            <p class="text-sm font-medium text-text-primary">
              {{ card.sessionName }}
              <template v-if="card.termName"> · {{ card.termName }}</template>
            </p>
            <p class="mt-0.5 text-xs text-text-muted">
              {{ card.className }}
              <template v-if="card.sectionName">
                · {{ card.sectionName }}</template
              >
              · Average {{ card.averageScore ?? '—' }} · Grade
              {{ card.overallGrade ?? '—' }}
            </p>
          </div>
          <a
            v-if="card.status === 'published'"
            :href="`/api/v1/report-cards/${card.id}/pdf`"
            class="rounded-md border border-border-strong px-3 py-1.5 text-sm text-brand-primary hover:bg-surface-muted"
            download
          >
            Download PDF
          </a>
          <span v-else class="text-xs uppercase tracking-wide text-text-muted">
            {{ card.status }}
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>
