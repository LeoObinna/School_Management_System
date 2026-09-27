<script setup lang="ts">
/**
 * VcsCard — standard content surface (08 §22): white, 1px neutral
 * border, 14px radius, 24px padding. `cream` is for feature/story
 * cards (08 §6); `flush` removes padding for media/tables. Optional
 * header (title + actions) and footer slots.
 */
withDefaults(
  defineProps<{
    title?: string
    cream?: boolean
    flush?: boolean
  }>(),
  { cream: false, flush: false },
)
</script>

<template>
  <section
    class="rounded-lg border border-border-default"
    :class="cream ? 'bg-surface-muted' : 'bg-surface'"
  >
    <header
      v-if="title || $slots.actions"
      class="flex items-start justify-between gap-4 border-b border-border-default px-6 py-4"
    >
      <h2 v-if="title" class="text-h5 text-text-primary">{{ title }}</h2>
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div :class="flush ? '' : 'p-6'">
      <slot />
    </div>

    <footer
      v-if="$slots.footer"
      class="border-t border-border-default px-6 py-4"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
