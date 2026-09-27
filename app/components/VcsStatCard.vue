<script setup lang="ts">
/**
 * VcsStatCard — single KPI tile for dashboards (08 §30). Values are
 * presentational only (format upstream). Optional icon slot; `hint`
 * carries subtext such as a period or comparison.
 */
defineProps<{
  label: string
  value: string | number
  hint?: string
}>()
</script>

<template>
  <div class="rounded-lg border border-border-default bg-surface p-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-label uppercase tracking-[0.08em] text-text-secondary">
        {{ label }}
      </p>
      <span
        v-if="$slots.icon"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary"
      >
        <slot name="icon" />
      </span>
    </div>
    <p class="mt-2 text-h4 font-semibold text-text-primary">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-body-sm text-text-muted">{{ hint }}</p>
  </div>
</template>
