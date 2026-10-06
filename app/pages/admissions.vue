<script setup lang="ts">
/**
 * Public admissions page (Phase 18C): application wizard + status checker.
 *
 * The wizard's class select is populated from the live academics payload
 * (active classes only); the session is pinned server-side to the current
 * academic session. Copy sticks to canonical facts — no invented fees or
 * policy claims.
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Admissions',
  description:
    'Apply to Victorious Children School, Ojodu, Lagos, or check the status of an application you have already submitted.',
  path: '/admissions',
})

const { data: academics } = await usePublicAcademics()

const classChoices = computed(() =>
  (academics.value?.levels ?? []).flatMap((level) =>
    level.classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: level.name,
    })),
  ),
)

function scrollToStatus() {
  document.getElementById('status-checker')?.scrollIntoView({
    behavior: 'smooth',
  })
}
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Admissions"
          title="Join the VCS family"
          description="Start your child's application online in a few minutes. Already applied? Check your application status below."
        />
        <div class="mt-8 flex flex-wrap gap-3">
          <VcsButton href="#apply" size="lg">
            Start an application
          </VcsButton>
          <VcsButton variant="secondary" size="lg" @click="scrollToStatus">
            Check application status
          </VcsButton>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 xl:px-8">
        <div class="grid gap-6 md:grid-cols-3">
          <VcsCard cream>
            <p class="font-display text-h3 text-brand-accent">1</p>
            <h3 class="mt-2 font-display text-h5 text-brand-primary">Apply online</h3>
            <p class="mt-2 text-body-sm text-text-secondary">
              Complete the form below. You will receive an application number
              (like APP-2026-0001) — keep it safe.
            </p>
          </VcsCard>
          <VcsCard cream>
            <p class="font-display text-h3 text-brand-accent">2</p>
            <h3 class="mt-2 font-display text-h5 text-brand-primary">Documents &amp; assessment</h3>
            <p class="mt-2 text-body-sm text-text-secondary">
              The school contacts you about the required documents and your
              child's assessment.
            </p>
          </VcsCard>
          <VcsCard cream>
            <p class="font-display text-h3 text-brand-accent">3</p>
            <h3 class="mt-2 font-display text-h5 text-brand-primary">Decision &amp; enrollment</h3>
            <p class="mt-2 text-body-sm text-text-secondary">
              Track progress any time with your application number, then
              complete enrollment when admitted.
            </p>
          </VcsCard>
        </div>
      </div>
    </section>

    <!-- Application wizard -->
    <section id="apply" class="bg-surface-subtle">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Apply"
          title="Application form"
          description="Fields marked * are required. You can review everything before submitting."
        />
        <div class="mx-auto mt-10 max-w-3xl">
          <AdmissionWizard :classes="classChoices" />
        </div>
      </div>
    </section>

    <!-- Status checker -->
    <section id="status-checker" class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Already applied?"
          title="Check your application status"
        />
        <div class="mx-auto mt-10 max-w-3xl">
          <StatusChecker />
        </div>
      </div>
    </section>
  </div>
</template>
