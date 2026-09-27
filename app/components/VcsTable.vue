<script setup lang="ts">
/**
 * VcsTable — styled semantic table wrapper for operational screens
 * (08 §27–§28). It supplies the surface, header treatment and row
 * rules; callers pass real <thead>/<tbody> markup in the default
 * slot. On small screens the table scrolls horizontally inside the
 * bordered surface rather than being squeezed.
 */
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-border-default bg-surface">
    <table class="w-full border-collapse text-left text-body-sm">
      <caption v-if="$slots.caption" class="sr-only">
        <slot name="caption" />
      </caption>
      <thead>
        <slot name="header" />
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<style scoped>
:deep(thead th) {
  background-color: var(--color-surface-subtle);
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-align: left;
  white-space: nowrap;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-default);
}

:deep(tbody td) {
  padding: 12px 16px;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-default);
  vertical-align: middle;
}

:deep(tbody tr:last-child td) {
  border-bottom: 0;
}

:deep(tbody tr:hover) {
  background-color: var(--color-surface-subtle);
}
</style>
