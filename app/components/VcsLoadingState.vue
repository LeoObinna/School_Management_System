<script setup lang="ts">
/**
 * VcsLoadingState — skeletons for known layouts (08 §48). Keeps
 * dimensions stable (no CLS) instead of a full-page spinner.
 * Variants: rows (list/table), cards (grid), text (prose blocks).
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'rows' | 'cards' | 'text'
    count?: number
    label?: string
  }>(),
  { variant: 'rows', count: 3, label: 'Loading' },
)

const items = computed(() => Array.from({ length: props.count }, (_, i) => i))
</script>

<template>
  <div role="status" aria-live="polite">
    <span class="sr-only">{{ label }}</span>
    <div aria-hidden="true">
      <!-- Rows -->
      <div v-if="variant === 'rows'" class="space-y-3">
        <div
          v-for="i in items"
          :key="i"
          class="h-12 animate-pulse rounded-md bg-neutral-100"
        />
      </div>

      <!-- Cards -->
      <div v-else-if="variant === 'cards'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="i in items"
          :key="i"
          class="h-40 animate-pulse rounded-lg border border-border-default bg-neutral-100"
        />
      </div>

      <!-- Text -->
      <div v-else class="space-y-3">
        <div
          v-for="i in items"
          :key="i"
          class="h-4 animate-pulse rounded bg-neutral-100"
          :class="i === items.length - 1 ? 'w-2/3' : i === items.length - 2 ? 'w-11/12' : 'w-full'"
        />
      </div>
    </div>
  </div>
</template>
