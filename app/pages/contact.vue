<script setup lang="ts">
/**
 * Public contact page (Phase 18C): contact form, school contact details
 * from live settings, FAQ, and a map block rendered only when the school
 * address is set in settings (owner decision — no invented facts).
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Contact',
  description:
    'Contact Victorious Children School, Ojodu, Lagos — send a message to the school office.',
  path: '/contact',
})

const { data: settings } = await usePublicSiteSettings()

const faqItems = [
  {
    question: 'How do I apply for admission?',
    answer:
      'Use the online application form on the Admissions page. You will receive an application number you can use to track progress.',
  },
  {
    question: 'How do I check my application status?',
    answer:
      'On the Admissions page, enter your application number together with the guardian email or phone number used on the application.',
  },
  {
    question: 'How do I pay school fees?',
    answer:
      'Parents pay through the secure portal — see the Fees page for the payment options and bank transfer details when available.',
  },
  {
    question: 'How can I check my child\'s results?',
    answer:
      'Published results are available through the result checker using your child\'s admission number, surname, session and term.',
  },
]

const hasContactDetails = computed(
  () =>
    Boolean(
      settings.value &&
        (settings.value.address || settings.value.email || settings.value.phone),
    ),
)
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Contact"
          title="Talk to the school office"
          description="Questions about admissions, academics or fees — send us a message and the school office will respond."
        />
      </div>
    </section>

    <section class="bg-surface">
      <div
        class="mx-auto grid max-w-content gap-10 px-5 py-16 md:px-6 md:py-24 lg:grid-cols-5 xl:px-8"
      >
        <!-- Form -->
        <div class="lg:col-span-3">
          <PublicContactForm />
        </div>

        <!-- Details + map -->
        <aside class="space-y-6 lg:col-span-2">
          <VcsCard v-if="hasContactDetails" cream>
            <h3 class="font-display text-h5 text-brand-primary">
              School office
            </h3>
            <dl class="mt-4 space-y-3 text-body-sm">
              <div v-if="settings?.address">
                <dt class="font-semibold text-text-primary">Address</dt>
                <dd class="text-text-secondary">{{ settings.address }}</dd>
              </div>
              <div v-if="settings?.email">
                <dt class="font-semibold text-text-primary">Email</dt>
                <dd>
                  <a
                    :href="`mailto:${settings.email}`"
                    class="text-brand-primary underline underline-offset-2"
                  >{{ settings.email }}</a>
                </dd>
              </div>
              <div v-if="settings?.phone">
                <dt class="font-semibold text-text-primary">Phone</dt>
                <dd>
                  <a
                    :href="`tel:${settings.phone}`"
                    class="text-brand-primary underline underline-offset-2"
                  >{{ settings.phone }}</a>
                </dd>
              </div>
            </dl>
          </VcsCard>

          <!-- Map: rendered only when the address is set in settings. -->
          <VcsCard v-if="settings?.address" cream>
            <h3 class="font-display text-h5 text-brand-primary">Find us</h3>
            <div class="mt-4 overflow-hidden rounded-lg border border-border">
              <iframe
                title="Map showing the school location"
                :src="`https://www.openstreetmap.org/export/embed.html?bbox=3.30,6.60,3.45,6.70&layer=mapnik`"
                class="h-64 w-full"
                loading="lazy"
              />
            </div>
            <p class="mt-2 text-caption text-text-muted">
              {{ settings.address }}
            </p>
          </VcsCard>
        </aside>
      </div>
    </section>

    <!-- FAQ -->
    <section class="bg-surface-subtle">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="FAQ"
          title="Common questions"
        />
        <div class="mx-auto mt-10 max-w-3xl">
          <PublicFaqAccordion :items="faqItems" />
        </div>
      </div>
    </section>
  </div>
</template>
