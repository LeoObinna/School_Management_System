<script setup lang="ts">
/**
 * Public homepage (Phase 18A).
 *
 * Placeholder hero + quick actions so `/` resolves after the routing
 * move (staff dashboard -> /dashboard). Dynamic sections (statistics,
 * news, gallery) land with the /api/v1/public/* group in the next 18A
 * step. Copy uses canonical facts only — school name, motto, location
 * (owner decision 2026-09-25: placeholders are clearly marked).
 */
definePageMeta({ layout: 'public', public: true })

useHead({
  title: 'Victorious Children School — Ojodu, Lagos',
  meta: [
    {
      name: 'description',
      content:
        'Victorious Children School, Ojodu, Lagos. Not to Equal, But to Excel.',
    },
  ],
})
</script>

<template>
  <div>
    <!-- Hero (brief §6, 08 §37) -->
    <section class="bg-surface-muted">
      <div
        class="mx-auto grid max-w-content items-center gap-10 px-5 py-16 md:px-6 md:py-24 lg:grid-cols-2 xl:px-8"
      >
        <div>
          <p
            class="text-label font-semibold uppercase tracking-[0.2em] text-brand-accent"
          >
            Ojodu • Lagos
          </p>
          <h1
            class="mt-4 font-display text-display font-semibold uppercase leading-[1.02] tracking-tight text-brand-primary"
          >
            Victorious<br>
            Children School
          </h1>
          <p class="mt-4 font-display text-h4 italic text-text-secondary">
            Not to Equal, But to Excel
          </p>
          <p class="mt-6 max-w-prose text-body-lg text-text-secondary">
            A welcoming Christian school community in Ojodu, Lagos, committed
            to academic excellence, discipline and character.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <VcsButton to="/admissions" size="lg">
              Apply Now
            </VcsButton>
            <VcsButton to="/auth/login" variant="secondary" size="lg">
              Pay Fees
            </VcsButton>
            <VcsButton to="/results/checker" variant="ghost" size="lg">
              Check Results
            </VcsButton>
          </div>
        </div>
        <div class="relative">
          <img
            src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Nigerian%20primary%20school%20children%20in%20neat%20uniforms%20walking%20into%20a%20bright%20modern%20school%20building%20in%20Lagos%2C%20warm%20morning%20light%2C%20welcoming%20atmosphere%2C%20photorealistic%2C%20editorial%20photography&image_size=landscape_4_3"
            alt="Pupils of Victorious Children School arriving at the school building in Ojodu, Lagos"
            class="w-full rounded-xl object-cover shadow-md"
            width="1024"
            height="768"
            loading="eager"
          >
        </div>
      </div>
    </section>

    <!-- Introduction placeholder — dynamic sections land with the
         /api/v1/public/* APIs later in 18A. -->
    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Welcome"
          title="One community, one standard"
        />
        <p class="mt-6 max-w-prose text-body-lg text-text-secondary">
          News, events, statistics and gallery highlights will appear here as
          the public website sections come online.
        </p>
      </div>
    </section>
  </div>
</template>
