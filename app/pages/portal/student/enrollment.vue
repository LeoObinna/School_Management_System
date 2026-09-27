<script setup lang="ts">
/**
 * Student portal — enrollment history (Phase 16A). VIEW-ONLY per the
 * Phase 16 owner decision: registration and placement changes stay
 * with staff; students see their current enrollment and history.
 */
import { studentsApi } from '~/services/students'
import { formatApiError } from '~/utils/errors'
import type { StudentEnrollmentDetail } from '~/shared/types'

definePageMeta({ layout: 'portal', permissions: ['dashboard.view'] })

const enrollments = ref<StudentEnrollmentDetail[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const current = computed(
  () => enrollments.value.find((e) => e.status === 'active') ?? null,
)
const history = computed(() => enrollments.value)

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

onMounted(async () => {
  try {
    const response = await studentsApi.listMyEnrollments()
    enrollments.value = response.data
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="font-display text-2xl font-semibold text-text-primary">
        Enrollment
      </h1>
      <p class="mt-1 text-sm text-text-secondary">
        Your class placement and enrollment history. Enrollment changes are
        handled by the school office.
      </p>
    </header>

    <div
      v-if="loading"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-text-muted"
      role="status"
    >
      Loading enrollment…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-border-default bg-surface p-6 text-sm text-brand-emphasis"
      role="alert"
    >
      {{ error }}
    </div>

    <template v-else>
      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">
          Current enrollment
        </h2>
        <p v-if="!current" class="mt-3 text-sm text-text-muted">
          No active enrollment at the moment.
        </p>
        <dl v-else class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">
              Class
            </dt>
            <dd class="mt-1 text-sm font-medium text-text-primary">
              {{ current.className
              }}<template v-if="current.sectionName">
                · {{ current.sectionName }}</template
              >
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">
              Session / term
            </dt>
            <dd class="mt-1 text-sm font-medium text-text-primary">
              {{ current.sessionName
              }}<template v-if="current.termName">
                · {{ current.termName }}</template
              >
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">
              Roll number
            </dt>
            <dd class="mt-1 text-sm font-medium text-text-primary">
              {{ current.rollNumber ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">
              Enrolled on
            </dt>
            <dd class="mt-1 text-sm font-medium text-text-primary">
              {{ fmtDate(current.enrollmentDate) }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-border-default bg-surface p-6">
        <h2 class="text-base font-semibold text-text-primary">History</h2>
        <p v-if="history.length === 0" class="mt-3 text-sm text-text-muted">
          No enrollment records yet.
        </p>
        <div v-else class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border-default text-left text-text-muted">
                <th class="py-2 pr-4 font-medium">Session</th>
                <th class="py-2 pr-4 font-medium">Term</th>
                <th class="py-2 pr-4 font-medium">Class</th>
                <th class="py-2 pr-4 font-medium">Status</th>
                <th class="py-2 font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in history"
                :key="row.id"
                class="border-b border-border-default last:border-0"
              >
                <td class="py-2 pr-4 text-text-primary">
                  {{ row.sessionName }}
                </td>
                <td class="py-2 pr-4 text-text-secondary">
                  {{ row.termName ?? '—' }}
                </td>
                <td class="py-2 pr-4 text-text-primary">
                  {{ row.className
                  }}<template v-if="row.sectionName">
                    · {{ row.sectionName }}</template
                  >
                </td>
                <td class="py-2 pr-4 capitalize text-text-secondary">
                  {{ row.status }}
                </td>
                <td class="py-2 text-text-secondary">
                  {{ fmtDate(row.enrollmentDate) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
