<script setup lang="ts">
/**
 * ResultChecker — public published-result lookup (Phase 18D).
 *
 * Identity factors: admission number + student surname + academic term
 * (session is the current session from the academics API). Only a
 * published result is answered; every mismatch shows one generic
 * "not found" state so admission numbers cannot be enumerated.
 */
import { fetchPublicResult } from '~/services/public'
import type { PublicResult } from '~/shared/types'

const props = defineProps<{
  session: { id: string; name: string } | null
  terms: { id: string; name: string }[]
}>()

const admissionNumber = ref('')
const surname = ref('')
const termId = ref('')
const checking = ref(false)
const notFound = ref(false)
const errorMessage = ref('')
const result = ref<PublicResult | null>(null)

const canCheck = computed(
  () => props.session !== null && props.terms.length > 0,
)

async function check() {
  errorMessage.value = ''
  notFound.value = false
  result.value = null

  if (!admissionNumber.value.trim()) {
    errorMessage.value = 'Enter the student admission number.'
    return
  }
  if (!surname.value.trim()) {
    errorMessage.value = 'Enter the student surname.'
    return
  }
  if (!termId.value) {
    errorMessage.value = 'Select the academic term.'
    return
  }

  checking.value = true
  try {
    result.value = await fetchPublicResult({
      admissionNumber: admissionNumber.value.trim(),
      surname: surname.value.trim(),
      sessionId: props.session!.id,
      termId: termId.value,
    })
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) {
      notFound.value = true
    } else if (status === 429) {
      errorMessage.value =
        'Too many checks. Please wait a few minutes and try again.'
    } else {
      errorMessage.value = 'The result check failed. Please try again.'
    }
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <VcsCard>
    <h3 class="font-display text-h4 text-brand-primary">
      Check published results
    </h3>
    <p class="mt-2 text-body-sm text-text-secondary">
      Enter the student's admission number and surname, then choose the
      academic term. Results are available only after the school has
      published them.
    </p>

    <!-- Unavailable state: no current session / terms in the academics API. -->
    <div v-if="!canCheck" class="mt-6" role="status">
      <p class="rounded-lg border border-border bg-surface-muted px-5 py-4 text-body text-text-secondary">
        Published results are not available online yet. Please check back
        later or contact the school office.
      </p>
    </div>

    <template v-else>
      <form class="mt-6 grid gap-5" novalidate @submit.prevent="check">
        <div class="grid gap-5 md:grid-cols-2">
          <VcsInput
            v-model="admissionNumber"
            label="Admission number"
            autocomplete="off"
            required
          />
          <VcsInput
            v-model="surname"
            label="Student surname"
            autocomplete="family-name"
            required
          />
        </div>
        <div class="grid gap-5 md:grid-cols-2">
          <VcsInput
            :model-value="session?.name ?? ''"
            label="Academic session"
            disabled
          />
          <VcsSelect
            v-model="termId"
            label="Academic term"
            required
            :options="[
              { label: 'Select a term', value: '', disabled: true },
              ...terms.map((t) => ({ label: t.name, value: t.id })),
            ]"
          />
        </div>

        <p
          v-if="errorMessage"
          role="alert"
          class="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-body-sm text-danger"
        >
          {{ errorMessage }}
        </p>

        <div>
          <VcsButton type="submit" :loading="checking">
            Check results
          </VcsButton>
        </div>
      </form>

      <!-- Result -->
      <div
        v-if="result"
        class="mt-6 space-y-5"
        role="status"
        aria-label="Published result"
      >
        <dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div class="flex justify-between gap-4 sm:block">
            <dt class="text-body-sm text-text-muted">Student</dt>
            <dd class="text-body font-medium text-text-primary">{{ result.studentName }}</dd>
          </div>
          <div class="flex justify-between gap-4 sm:block">
            <dt class="text-body-sm text-text-muted">Admission number</dt>
            <dd class="font-mono text-body font-medium text-text-primary">{{ result.admissionNumber }}</dd>
          </div>
          <div class="flex justify-between gap-4 sm:block">
            <dt class="text-body-sm text-text-muted">Session</dt>
            <dd class="text-body text-text-primary">{{ result.sessionName }}</dd>
          </div>
          <div class="flex justify-between gap-4 sm:block">
            <dt class="text-body-sm text-text-muted">Term / class</dt>
            <dd class="text-body text-text-primary">
              {{ result.termName }} — {{ result.className }}
            </dd>
          </div>
        </dl>

        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="min-w-full divide-y divide-border text-body-sm">
            <caption class="sr-only">
              Subject scores for {{ result.studentName }}
            </caption>
            <thead class="bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
              <tr>
                <th class="px-4 py-3 font-semibold">Subject</th>
                <th class="px-4 py-3 text-right font-semibold">Score</th>
                <th class="hidden px-4 py-3 text-right font-semibold sm:table-cell">Out of</th>
                <th class="px-4 py-3 text-right font-semibold">Average</th>
                <th class="px-4 py-3 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border bg-surface">
              <tr v-for="s in result.subjects" :key="s.subjectName">
                <td class="px-4 py-3 font-medium text-text-primary">{{ s.subjectName }}</td>
                <td class="px-4 py-3 text-right tabular-nums text-text-primary">{{ s.totalScore }}</td>
                <td class="hidden px-4 py-3 text-right tabular-nums text-text-secondary sm:table-cell">{{ s.maxScore }}</td>
                <td class="px-4 py-3 text-right tabular-nums text-text-primary">{{ s.percentage }}%</td>
                <td class="px-4 py-3">
                  <VcsBadge :tone="s.grade ? 'info' : 'neutral'">
                    {{ s.grade ?? '—' }}
                  </VcsBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-lg border border-border px-4 py-3">
            <dt class="text-body-sm text-text-muted">Total score</dt>
            <dd class="mt-1 text-h5 font-semibold text-text-primary tabular-nums">{{ result.totalScore }}</dd>
          </div>
          <div class="rounded-lg border border-border px-4 py-3">
            <dt class="text-body-sm text-text-muted">Average</dt>
            <dd class="mt-1 text-h5 font-semibold text-text-primary tabular-nums">{{ result.averageScore }}%</dd>
          </div>
          <div class="rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-4 py-3">
            <dt class="text-body-sm text-text-muted">Overall grade</dt>
            <dd class="mt-1 text-h5 font-semibold text-brand-primary">{{ result.overallGrade ?? '—' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Generic not-found: indistinguishable from unpublished. -->
      <div
        v-else-if="notFound"
        class="mt-6 rounded-lg border border-border bg-surface-muted px-5 py-4"
        role="status"
      >
        <p class="text-body text-text-secondary">
          We could not find published results matching those details.
          Check the admission number, surname and term, or contact the
          school office.
        </p>
      </div>
    </template>
  </VcsCard>
</template>
