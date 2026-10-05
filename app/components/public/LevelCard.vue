<script setup lang="ts">
/**
 * LevelCard — one academic level with its classes and the subjects each
 * class offers (Phase 18B). Data comes from /api/v1/public/academics;
 * levels without a name are labelled "Classes" by the page.
 */
defineProps<{
  name: string
  classes: { name: string; subjects: string[] }[]
}>()
</script>

<template>
  <VcsCard cream>
    <h3 class="font-display text-h4 text-brand-primary">
      {{ name }}
    </h3>
    <ul class="mt-4 space-y-4">
      <li v-for="klass in classes" :key="klass.name">
        <p class="text-body font-semibold text-text-primary">
          {{ klass.name }}
        </p>
        <p
          v-if="klass.subjects.length > 0"
          class="mt-1 text-body-sm text-text-secondary"
        >
          {{ klass.subjects.join(', ') }}
        </p>
      </li>
    </ul>
  </VcsCard>
</template>
