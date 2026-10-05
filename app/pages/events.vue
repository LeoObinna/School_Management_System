<script setup lang="ts">
/**
 * Public events page (Phase 18B) — published, audience-all events split
 * into upcoming and past. Both lists are fetched up front; the toggle is
 * a client-side switch.
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Events',
  description:
    'Upcoming and past events at Victorious Children School, Ojodu, Lagos.',
  path: '/events',
})

const [{ data: upcoming }, { data: past }] = await Promise.all([
  usePublicEvents('upcoming'),
  usePublicEvents('past'),
])

const tab = ref<'upcoming' | 'past'>('upcoming')
const shown = computed(() =>
  tab.value === 'upcoming' ? (upcoming.value?.data ?? []) : (past.value?.data ?? []),
)

const tabs = [
  { key: 'upcoming' as const, label: 'Upcoming' },
  { key: 'past' as const, label: 'Past' },
]
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsSectionHeader
          eyebrow="Events"
          title="School events"
          description="What's happening at Victorious Children School."
        />
        <div class="mt-8 flex justify-center gap-2" role="tablist">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="tab === t.key"
            class="rounded-md px-4 py-2 text-button transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            :class="
              tab === t.key
                ? 'bg-brand-primary text-text-inverse'
                : 'bg-surface text-text-secondary hover:bg-surface-subtle'
            "
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsEmptyState
          v-if="shown.length === 0"
          :title="tab === 'upcoming' ? 'No upcoming events' : 'No past events'"
          description="Published school events will appear here. Check back soon."
        />
        <div v-else class="grid gap-4 md:grid-cols-2">
          <EventCard v-for="event in shown" :key="event.id" :event="event" />
        </div>
      </div>
    </section>
  </div>
</template>
