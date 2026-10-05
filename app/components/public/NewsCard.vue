<script setup lang="ts">
/**
 * NewsCard — one published news item in a card grid (Phase 18B).
 * Links to the news detail page; the body shows as a plain-text excerpt
 * (never HTML).
 */
import type { PublicNewsItem } from '~/shared/types'

const props = defineProps<{ item: PublicNewsItem }>()

const excerpt = computed(() => {
  const body = props.item.body?.trim() ?? ''
  if (body.length <= 160) return body
  return `${body.slice(0, 157).trimEnd()}…`
})
</script>

<template>
  <NuxtLink
    :to="`/news/${item.id}`"
    class="group flex h-full flex-col rounded-lg border border-border-default bg-surface p-6 shadow-sm transition-shadow duration-[var(--duration-fast)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
  >
    <p
      v-if="item.publishedAt"
      class="text-label font-medium uppercase tracking-wide text-brand-accent"
    >
      {{ formatPublicDateShort(item.publishedAt) }}
    </p>
    <h3
      class="mt-2 font-display text-h5 text-brand-primary group-hover:underline"
    >
      {{ item.title }}
    </h3>
    <p v-if="excerpt" class="mt-3 text-body text-text-secondary">
      {{ excerpt }}
    </p>
    <span
      class="mt-4 text-button text-brand-primary"
      aria-hidden="true"
    >Read more →</span>
  </NuxtLink>
</template>
