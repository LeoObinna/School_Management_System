<script setup lang="ts">
/**
 * VcsBadge — compact semantic pill/tag (08 §29). Status is never
 * conveyed by colour alone: the label is always rendered. For common
 * workflow statuses use VcsStatusBadge, which maps status → tone.
 */
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
    pill?: boolean
  }>(),
  { tone: 'neutral', pill: false },
)

const tones: Record<string, string> = {
  neutral: 'border-border-default bg-surface-subtle text-text-secondary',
  info: 'border-transparent bg-brand-primary/10 text-brand-primary',
  success: 'border-transparent bg-success/10 text-success',
  warning: 'border-transparent bg-warning/10 text-warning',
  danger: 'border-transparent bg-danger/10 text-danger',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 border px-2 py-0.5 text-caption font-semibold"
    :class="[tones[tone], pill ? 'rounded-full' : 'rounded-sm']"
  >
    <slot />
  </span>
</template>
