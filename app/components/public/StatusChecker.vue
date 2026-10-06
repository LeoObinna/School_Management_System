<script setup lang="ts">
/**
 * StatusChecker — public application status lookup (Phase 18C).
 *
 * Requires the application number plus the guardian email or phone used
 * on the application. Any mismatch shows one generic "not found" state —
 * the API never reveals which factor failed.
 */
import { fetchPublicApplicationStatus } from '~/services/public'
import type { AdmissionStatusResponse } from '~/shared/schemas/public'

const applicationNumber = ref('')
const guardianEmail = ref('')
const guardianPhone = ref('')
const checking = ref(false)
const notFound = ref(false)
const errorMessage = ref('')
const result = ref<AdmissionStatusResponse | null>(null)

async function check() {
  errorMessage.value = ''
  notFound.value = false
  result.value = null

  if (!applicationNumber.value.trim()) {
    errorMessage.value = 'Enter the application number (e.g. APP-2026-0001).'
    return
  }
  if (!guardianEmail.value.trim() && !guardianPhone.value.trim()) {
    errorMessage.value = 'Enter the guardian email or phone used on the application.'
    return
  }

  checking.value = true
  try {
    result.value = await fetchPublicApplicationStatus({
      applicationNumber: applicationNumber.value.trim(),
      guardianEmail: guardianEmail.value.trim() || undefined,
      guardianPhone: guardianPhone.value.trim() || undefined,
    })
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) {
      notFound.value = true
    } else if (status === 429) {
      errorMessage.value = 'Too many checks. Please wait a few minutes and try again.'
    } else {
      errorMessage.value = 'The status check failed. Please try again.'
    }
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <VcsCard>
    <h3 class="font-display text-h4 text-brand-primary">
      Check application status
    </h3>
    <p class="mt-2 text-body-sm text-text-secondary">
      Enter the application number you received, plus the guardian email or
      phone number used on the application.
    </p>

    <form class="mt-6 grid gap-5" novalidate @submit.prevent="check">
      <VcsInput
        v-model="applicationNumber"
        label="Application number"
        placeholder="APP-2026-0001"
        required
      />
      <div class="grid gap-5 md:grid-cols-2">
        <VcsInput
          v-model="guardianEmail"
          label="Guardian email"
          type="email"
          inputmode="email"
          autocomplete="email"
        />
        <VcsInput
          v-model="guardianPhone"
          label="Guardian phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
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
          Check status
        </VcsButton>
      </div>
    </form>

    <!-- Result states -->
    <div
      v-if="result"
      class="mt-6 rounded-lg border border-success/30 bg-success/10 px-5 py-4"
      role="status"
    >
      <p class="text-body text-text-primary">
        <span class="font-mono font-semibold">{{ result.applicationNumber }}</span>
        —
        <strong>{{ result.statusLabel }}</strong>
      </p>
    </div>
    <div
      v-else-if="notFound"
      class="mt-6 rounded-lg border border-border bg-surface-muted px-5 py-4"
      role="status"
    >
      <p class="text-body text-text-secondary">
        We could not find an application matching those details. Check the
        application number and the guardian email or phone, or contact the
        school office.
      </p>
    </div>
  </VcsCard>
</template>
