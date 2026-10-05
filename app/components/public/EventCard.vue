<script setup lang="ts">
/**
 * EventCard — one published event with a calendar date block
 * (Phase 18B).
 */
import type { PublicEvent } from '~/shared/types'

const props = defineProps<{ event: PublicEvent }>()

const parts = computed(() => publicDateParts(props.event.startsAt))
</script>

<template>
  <article
    class="flex gap-5 rounded-lg border border-border-default bg-surface p-5 shadow-sm"
  >
    <div
      v-if="parts"
      class="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md bg-brand-primary text-text-inverse"
      aria-hidden="true"
    >
      <span class="font-display text-h4 font-semibold leading-none">
        {{ parts.day }}
      </span>
      <span class="mt-1 text-label uppercase tracking-wide">
        {{ parts.month }}
      </span>
    </div>
    <div class="min-w-0">
      <h3 class="font-display text-h5 text-brand-primary">
        {{ event.title }}
      </h3>
      <p class="mt-1 text-body-sm text-text-secondary">
        <span v-if="parts">{{ formatPublicDate(event.startsAt) }}</span>
        <template v-if="event.endsAt">
          – {{ formatPublicDate(event.endsAt) }}</template
        >
        <template v-if="event.location"> • {{ event.location }}</template>
      </p>
      <p
        v-if="event.description"
        class="mt-2 text-body text-text-secondary"
      >
        {{ event.description }}
      </p>
    </div>
  </article>
</template>
