<script setup lang="ts">
import { financeApi } from '~/services/finance'
import { formatApiError } from '~/utils/errors'
import { formatMoney } from '~/shared/utils/money'
import type { PaystackVerifyResult } from '~/shared/types'

definePageMeta({ permissions: ['payments.view'] })

const route = useRoute()
const state = ref<'loading' | 'done' | 'error'>('loading')
const result = ref<PaystackVerifyResult | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const reference =
    typeof route.query.reference === 'string' ? route.query.reference : ''
  if (!reference) {
    state.value = 'error'
    errorMessage.value = 'This link is missing a payment reference.'
    return
  }
  try {
    result.value = await financeApi.verifyPaystack(reference)
    state.value = 'done'
  } catch (e) {
    state.value = 'error'
    errorMessage.value = formatApiError(e)
  }
})
</script>

<template>
  <div class="mx-auto max-w-lg px-4 py-16">
    <div
      class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm"
    >
      <template v-if="state === 'loading'">
        <h1 class="text-lg font-semibold text-gray-900">
          Confirming your payment…
        </h1>
        <p class="mt-2 text-sm text-gray-500">
          Please wait while we verify the transaction with the payment
          gateway.
        </p>
      </template>

      <template v-else-if="state === 'error'">
        <h1 class="text-lg font-semibold text-red-700">
          We could not confirm this payment
        </h1>
        <p class="mt-2 text-sm text-gray-600">{{ errorMessage }}</p>
        <p class="mt-2 text-sm text-gray-500">
          If money left your account, the school office can reconcile it —
          quote your payment reference.
        </p>
      </template>

      <template v-else-if="result?.verified">
        <h1 class="text-lg font-semibold text-green-700">Payment confirmed</h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ formatMoney(result.payment.amount) }} received on invoice
          {{ result.payment.invoiceNumber }}.
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Reference {{ result.payment.paymentReference }}
          <template v-if="result.payment.receiptNumber">
            · Receipt {{ result.payment.receiptNumber }}
          </template>
        </p>
      </template>

      <template v-else>
        <h1 class="text-lg font-semibold text-amber-700">
          Payment not yet confirmed
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          The gateway reports this transaction as
          "{{ result?.gatewayStatus ?? 'pending' }}". If you completed the
          payment, it will reflect shortly — you can safely close this page
          and check your billing page in a few minutes.
        </p>
      </template>

      <NuxtLink
        to="/billing"
        class="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to my billing
      </NuxtLink>
    </div>
  </div>
</template>
