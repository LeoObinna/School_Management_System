<script setup lang="ts">
/**
 * Public homepage (Phase 18A) — section order per UI brief §6:
 * hero → primary actions → introduction → statistics → why VCS →
 * (academic levels land in 18B with the academics API) → admissions CTA
 * → news/events → gallery/community → portal CTA. Header/footer come
 * from the public layout.
 *
 * Copy uses canonical facts only (name, motto, Ojodu • Lagos). Statistics,
 * news, events, gallery covers and academic levels are live from the
 * 18A/18B public APIs; each section falls back to a clearly-marked empty
 * state until content is published.
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Victorious Children School',
  description:
    'Victorious Children School, Ojodu, Lagos. Not to Equal, But to Excel.',
  path: '/',
})

const { data: stats } = await usePublicStats()

// 18B: live content sections — latest news, next events, recent albums.
const [{ data: news }, { data: upcomingEvents }, { data: albums }] =
  await Promise.all([
    usePublicNews(1, 3),
    usePublicEvents('upcoming', 1, 3),
    usePublicAlbums(1, 6),
  ])

const statCards = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'Students', value: stats.value.students },
    { label: 'Teachers', value: stats.value.teachers },
    { label: 'Classes', value: stats.value.classes },
    { label: 'Subjects', value: stats.value.subjects },
  ]
})

const newsItems = computed(() => news.value?.data ?? [])
const eventItems = computed(() => upcomingEvents.value?.data ?? [])
const albumItems = computed(() =>
  (albums.value?.data ?? []).filter((a) => a.coverUrl !== null),
)

const { data: academics } = await usePublicAcademics()
const levelStrips = computed(() =>
  (academics.value?.levels ?? []).map((level) => ({
    label: level.name ?? 'Classes',
    classNames: level.classes.map((c) => c.name),
  })),
)

const whyItems = [
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
          <!-- Primary actions (brief §6) -->
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

    <!-- Introduction -->
    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Welcome"
          title="One community, one standard"
          description="At Victorious Children School every child is known by name. We combine a caring Christian environment with firm academic standards, so pupils grow in knowledge, skill and godly character."
        />
      </div>
    </section>

    <!-- Statistics (live aggregate counts; hidden until loaded) -->
    <section v-if="statCards.length > 0" class="bg-surface-subtle">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 xl:px-8">
        <dl class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          <VcsStatCard
            v-for="card in statCards"
            :key="card.label"
            :label="card.label"
            :value="card.value"
          />
        </dl>
      </div>
    </section>

    <!-- Why VCS -->
    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Why VCS"
          title="A school built on purpose"
          description="Families choose Victorious Children School for the things that shape a child for life."
        />
        <div class="mt-12 grid gap-6 md:grid-cols-3">
          <VcsCard v-for="item in whyItems" :key="item.title" cream>
            <h3 class="font-display text-h5 text-brand-primary">
              {{ item.title }}
            </h3>
            <p class="mt-3 text-body text-text-secondary">
              {{ item.body }}
            </p>
          </VcsCard>
        </div>
      </div>
    </section>

    <!-- Academic levels (18B: live from /api/v1/public/academics) -->
    <section v-if="levelStrips.length > 0" class="bg-surface-subtle">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Academics"
          title="A place for every stage"
          description="From the first classroom steps upwards, every level follows the same standard of care and expectation."
        />
        <div class="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <VcsCard v-for="level in levelStrips" :key="level.label" cream>
            <h3 class="font-display text-h5 text-brand-primary">
              {{ level.label }}
            </h3>
            <p class="mt-2 text-body-sm text-text-secondary">
              {{ level.classNames.join(' • ') }}
            </p>
          </VcsCard>
        </div>
        <div class="mt-10 text-center">
          <VcsButton to="/academics" variant="secondary">
            Explore academics
          </VcsButton>
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
            Admissions are open
          </h2>
          <p class="mt-3 max-w-prose text-body-lg text-text-inverse/85">
            Start your child's application online in a few minutes — or check
            the status of an application you have already submitted.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <VcsButton to="/admissions" variant="gold" size="lg">
            Apply Now
          </VcsButton>
          <VcsButton
            to="/admissions"
            variant="ghost"
            size="lg"
            class="text-text-inverse hover:bg-white/10 hover:text-text-inverse"
          >
            Check application status
          </VcsButton>
        </div>
      </div>
    </section>

    <!-- News & events (18B: live published content) -->
    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="News & Events"
          title="Life at VCS"
        />
        <VcsEmptyState
          v-if="newsItems.length === 0 && eventItems.length === 0"
          class="mt-10"
          title="News and events are on the way"
          description="Announcements, event highlights and school stories will be published here. Check back soon."
        />
        <template v-else>
          <div
            v-if="newsItems.length > 0"
            class="mt-12 grid gap-6 md:grid-cols-3"
          >
            <PublicNewsCard v-for="item in newsItems" :key="item.id" :item="item" />
          </div>
          <div
            v-if="eventItems.length > 0"
            class="mt-10 grid gap-4 md:grid-cols-3"
          >
            <PublicEventCard
              v-for="event in eventItems"
              :key="event.id"
              :event="event"
            />
          </div>
          <div class="mt-10 flex flex-wrap justify-center gap-3">
            <VcsButton to="/news" variant="secondary">All news</VcsButton>
            <VcsButton to="/events" variant="ghost">All events</VcsButton>
          </div>
        </template>
      </div>
    </section>

    <!-- Gallery / community (18B: live published album covers) -->
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Gallery"
          title="Our community in pictures"
        />
        <VcsEmptyState
          v-if="albumItems.length === 0"
          class="mt-10"
          title="Gallery coming soon"
          description="Photos from classrooms, events and school life will appear here once albums are published."
        />
        <template v-else>
          <div class="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
            <NuxtLink
              v-for="album in albumItems"
              :key="album.id"
              to="/gallery"
              class="group overflow-hidden rounded-lg shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <img
                :src="album.coverUrl!"
                :alt="`Photos from ${album.title}`"
                class="aspect-[4/3] w-full object-cover transition-transform duration-[var(--duration-normal)] group-hover:scale-[1.02]"
                loading="lazy"
              >
            </NuxtLink>
          </div>
          <div class="mt-10 text-center">
            <VcsButton to="/gallery" variant="secondary">
              Browse the gallery
            </VcsButton>
          </div>
        </template>
      </div>
    </section>

    <!-- Portal CTA -->
    <section class="bg-surface">
      <div
        class="mx-auto flex max-w-content flex-col items-center gap-6 px-5 py-16 text-center md:px-6 md:py-20 xl:px-8"
      >
        <h2 class="font-display text-h2 text-text-primary">
          Already part of the family?
        </h2>
        <p class="max-w-prose text-body-lg text-text-secondary">
          Parents, students and staff use the school portal for results,
          fees, attendance, assignments and announcements.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <VcsButton to="/auth/login" size="lg">
            Portal Login
          </VcsButton>
          <VcsButton to="/results/checker" variant="secondary" size="lg">
            Check Results
          </VcsButton>
        </div>
      </div>
    </section>
  </div>
</template>
