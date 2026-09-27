<script setup lang="ts">
/**
 * VcsSectionHeader — public editorial section heading (08 §38):
 * eyebrow, heading (display font for storytelling moments), short
 * paragraph. Not every section needs all three; editorial sections
 * may intentionally omit this component.
 */
withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    description?: string
    align?: 'left' | 'center'
  }>(),
  { align: 'center' },
)
</script>

<template>
  <div
    class="max-w-reading"
    :class="align === 'center' ? 'mx-auto text-center' : 'text-left'"
  >
    <p
      v-if="eyebrow"
      class="text-label font-semibold uppercase tracking-[0.16em] text-brand-primary"
    >
      {{ eyebrow }}
    </p>
    <h2
      class="font-display text-h2 text-text-primary"
      :class="eyebrow ? 'mt-3' : ''"
    >
      {{ title }}
    </h2>
    <p v-if="description" class="mt-4 text-body-lg text-text-secondary">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="mt-6">
      <slot name="actions" />
    </div>
  </div>
</template>
