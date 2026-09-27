<script setup lang="ts">
/**
 * VcsPageHeader — portal/operational page header (08 §30).
 * Title is the page H1; `actions` holds the page-level controls.
 * Optional `breadcrumb` slot renders above the title.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mb-6">
    <nav v-if="$slots.breadcrumb" aria-label="Breadcrumb" class="mb-2">
      <slot name="breadcrumb" />
    </nav>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-h3 text-text-primary">{{ title }}</h1>
        <p v-if="description" class="mt-1.5 text-body text-text-secondary">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
