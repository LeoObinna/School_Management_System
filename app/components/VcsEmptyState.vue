<script setup lang="ts">
/**
 * VcsEmptyState — intentional empty state (08 §47). Never fake
 * records to avoid this. `icon` is an optional slot (typically a
 * single Lucide-style 20–24px glyph); `action` holds the recovery
 * control.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div
      v-if="$slots.icon"
      class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-secondary"
    >
      <slot name="icon" />
    </div>
    <h3 class="text-h5 text-text-primary">{{ title }}</h3>
    <p v-if="description" class="mt-2 max-w-md text-body-sm text-text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>
