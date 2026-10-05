<script setup lang="ts">
/**
 * Public academics page (Phase 18B) — current session/terms and the
 * active class structure with subject names, straight from the database
 * (no invented curriculum copy). Classes without a level group under a
 * generic "Classes" heading.
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Academics',
  description:
    'Classes and subjects at Victorious Children School, Ojodu, Lagos.',
  path: '/academics',
})

const { data: academics } = await usePublicAcademics()

const levels = computed(() =>
  (academics.value?.levels ?? []).map((level) => ({
    ...level,
    label: level.name ?? 'Classes',
  })),
)
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsSectionHeader
          eyebrow="Academics"
          title="Learning at VCS"
          description="Our classes and the subjects taught in each, for the current academic session."
        />
        <p
          v-if="academics?.session"
          class="mt-6 text-center text-body-sm text-text-secondary"
        >
          Current session: {{ academics.session.name }}
          <template v-for="term in academics.terms" :key="term.name">
            <template v-if="term.isCurrent"> • {{ term.name }}</template>
          </template>
        </p>
      </div>
    </section>

    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsEmptyState
          v-if="levels.length === 0"
          title="Class structure coming soon"
          description="Our academic structure for the current session will be published here."
        />
        <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <LevelCard
            v-for="level in levels"
            :key="level.label"
            :name="level.label"
            :classes="level.classes"
          />
        </div>
      </div>
    </section>

    <!-- Admissions CTA -->
    <section class="bg-brand-primary">
      <div
        class="mx-auto flex max-w-content flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:px-6 md:py-20 xl:px-8"
      >
        <div>
          <h2 class="font-display text-h2 text-text-inverse">
            Ready to join us?
          </h2>
          <p class="mt-3 max-w-prose text-body-lg text-text-inverse/85">
            Start your child's application online in a few minutes.
          </p>
        </div>
        <VcsButton to="/admissions" variant="gold" size="lg">
          Apply Now
        </VcsButton>
      </div>
    </section>
  </div>
</template>
