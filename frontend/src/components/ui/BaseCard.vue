<script setup lang="ts">
/** Surface container for grouped content. */
withDefaults(
  defineProps<{
    title?: string
    padded?: boolean
  }>(),
  {
    title: undefined,
    padded: true,
  },
)
</script>

<template>
  <section class="rounded-card border border-slate-200 bg-surface shadow-sm">
    <header v-if="title || $slots.header" class="border-b border-slate-100 px-5 py-4">
      <slot name="header">
        <h2 class="text-base font-semibold text-content">{{ title }}</h2>
      </slot>
    </header>
    <div :class="padded ? 'px-5 py-4' : ''">
      <slot />
    </div>
  </section>
</template>
