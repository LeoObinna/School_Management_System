<script setup lang="ts">
/**
 * Public Fees page (Phase 18B). Per the Phase 18 plan the fee schedule
 * itself is NOT published: the page carries payment instructions
 * (placeholder) plus the school's bank transfer block — rendered only
 * when all three bank fields are populated in school settings — and a
 * Pay Fees action that routes to the portal login (fee payment is an
 * authenticated portal flow).
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Fees',
  description:
    'How to pay school fees at Victorious Children School, Ojodu, Lagos.',
  path: '/fees',
})

const { data: settings } = await usePublicSiteSettings()

const bank = computed(() => {
  const s = settings.value
  if (!s?.bankName || !s?.accountName || !s?.accountNumber) return null
  return {
    bankName: s.bankName,
    accountName: s.accountName,
    accountNumber: s.accountNumber,
  }
})
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsSectionHeader
          eyebrow="Fees"
          title="Paying school fees"
          description="Simple ways to pay — online through the portal, or by bank transfer."
        />
      </div>
    </section>

    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <div class="grid gap-6 md:grid-cols-2">
          <!-- Portal payment -->
          <VcsCard>
            <h2 class="font-display text-h4 text-brand-primary">
              Pay online
            </h2>
            <p class="mt-3 text-body text-text-secondary">
              Parents and guardians pay fees securely through the school
              portal — you can see invoices, balances and receipts in one
              place.
            </p>
            <!-- Placeholder — replace with school-provided payment guidance. -->
            <p class="mt-3 text-body-sm text-text-secondary">
              <span
                class="mr-2 rounded-sm bg-brand-accent/20 px-1.5 py-0.5 text-label font-semibold uppercase tracking-wide text-brand-primary"
              >Placeholder</span>
              Detailed payment instructions will be published here soon.
            </p>
            <div class="mt-6">
              <VcsButton to="/auth/login" size="lg">Pay Fees</VcsButton>
            </div>
          </VcsCard>

          <!-- Bank transfer (only when configured in school settings) -->
          <VcsCard v-if="bank">
            <h2 class="font-display text-h4 text-brand-primary">
              Bank transfer
            </h2>
            <p class="mt-3 text-body text-text-secondary">
              Transfer to the school account below, then bring or send your
              payment evidence to the school office so your payment can be
              confirmed.
            </p>
            <dl class="mt-5 space-y-3">
              <div class="flex justify-between gap-4">
                <dt class="text-body-sm text-text-secondary">Bank</dt>
                <dd class="text-body font-semibold text-text-primary">
                  {{ bank.bankName }}
                </dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-body-sm text-text-secondary">Account name</dt>
                <dd class="text-body font-semibold text-text-primary">
                  {{ bank.accountName }}
                </dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-body-sm text-text-secondary">
                  Account number
                </dt>
                <dd class="text-body font-semibold tracking-wide text-text-primary">
                  {{ bank.accountNumber }}
                </dd>
              </div>
            </dl>
          </VcsCard>

          <!-- Bank transfer not configured -->
          <VcsCard v-else>
            <h2 class="font-display text-h4 text-brand-primary">
              Bank transfer
            </h2>
            <p class="mt-3 text-body text-text-secondary">
              Bank transfer details are available from the school office.
            </p>
          </VcsCard>
        </div>

        <p class="mt-10 text-center text-body-sm text-text-secondary">
          Questions about fees?
          <NuxtLink
            to="/contact"
            class="font-semibold text-brand-primary hover:underline"
          >Contact the school office</NuxtLink>.
        </p>
      </div>
    </section>
  </div>
</template>
