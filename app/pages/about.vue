<script setup lang="ts">
/**
 * Public About page (Phase 18B). Canonical facts only — school name,
 * motto, Ojodu • Lagos. Longer history/leadership copy is a clearly
 * marked placeholder awaiting school-provided content (owner decision
 * 2026-09-25: placeholders ship, no invented facts; staff profiles are
 * excluded — no consent flag exists).
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'About',
  description:
    'About Victorious Children School, Ojodu, Lagos — Not to Equal, But to Excel.',
  path: '/about',
})

const values = [
  {
    title: 'Christian values',
    body: 'A faith-shaped school culture where character is taught alongside academics.',
  },
  {
    title: 'Academic excellence',
    body: 'Structured teaching, careful assessment and high expectations for every child.',
  },
  {
    title: 'Discipline & character',
    body: 'A safe, orderly environment where pupils learn respect, diligence and integrity.',
  },
]
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsSectionHeader
          eyebrow="About us"
          title="Victorious Children School"
          description="Not to Equal, But to Excel."
        />
      </div>
    </section>

    <section class="bg-surface">
      <div
        class="mx-auto grid max-w-content items-center gap-10 px-5 py-16 md:px-6 md:py-24 lg:grid-cols-2 xl:px-8"
      >
        <div>
          <h2 class="font-display text-h2 text-brand-primary">
            A school in the heart of Ojodu
          </h2>
          <p class="mt-4 text-body-lg text-text-secondary">
            Victorious Children School is a Christian school in Ojodu, Lagos.
            We provide a caring, disciplined environment where every child is
            known by name and encouraged to excel.
          </p>
          <!-- Placeholder — replace with school-provided history/mission copy. -->
          <p class="mt-4 text-body text-text-secondary">
            <span
              class="mr-2 rounded-sm bg-brand-accent/20 px-1.5 py-0.5 text-label font-semibold uppercase tracking-wide text-brand-primary"
            >Placeholder</span>
            Our full story — our history, mission and leadership — will be
            published here soon.
          </p>
        </div>
        <img
          src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Nigerian%20primary%20school%20classroom%20with%20children%20in%20uniforms%20raising%20hands%2C%20teacher%20smiling%20at%20the%20front%2C%20bright%20airy%20room%2C%20photorealistic%2C%20editorial%20photography&image_size=landscape_4_3"
          alt="A bright classroom at Victorious Children School"
          class="w-full rounded-xl object-cover shadow-md"
          width="1024"
          height="768"
          loading="lazy"
        >
      </div>
    </section>

    <section class="bg-surface-subtle">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Our values"
          title="What shapes every school day"
        />
        <div class="mt-12 grid gap-6 md:grid-cols-3">
          <VcsCard v-for="value in values" :key="value.title" cream>
            <h3 class="font-display text-h5 text-brand-primary">
              {{ value.title }}
            </h3>
            <p class="mt-3 text-body text-text-secondary">
              {{ value.body }}
            </p>
          </VcsCard>
        </div>
      </div>
    </section>

    <section class="bg-brand-primary">
      <div
        class="mx-auto flex max-w-content flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:px-6 md:py-20 xl:px-8"
      >
        <div>
          <h2 class="font-display text-h2 text-text-inverse">
            Come and see for yourself
          </h2>
          <p class="mt-3 max-w-prose text-body-lg text-text-inverse/85">
            The best way to know a school is to visit. Start an application or
            send us a message.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <VcsButton to="/admissions" variant="gold" size="lg">
            Apply Now
          </VcsButton>
          <VcsButton
            to="/contact"
            variant="ghost"
            size="lg"
            class="text-text-inverse hover:bg-white/10 hover:text-text-inverse"
          >
            Contact us
          </VcsButton>
        </div>
      </div>
    </section>
  </div>
</template>
