<script setup lang="ts">
/**
 * VcsStatusBadge — workflow status pill (08 §29). Maps a domain
 * status string (e.g. "Partially Paid", "OVERDUE") to a semantic
 * tone via status-tones.ts and always renders the label as text, so
 * status is never communicated by colour alone.
 */
import { computed } from 'vue'
import { formatStatusLabel, statusTone } from './vcs/status-tones'

const props = defineProps<{ status: string }>()

const tone = computed(() => statusTone(props.status))
const label = computed(() => formatStatusLabel(props.status))

const tones: Record<string, string> = {
  neutral: 'bg-surface-subtle text-text-secondary border-border-default',
  info: 'bg-brand-primary/10 text-brand-primary border-transparent',
  success: 'bg-success/10 text-success border-transparent',
  warning: 'bg-warning/10 text-warning border-transparent',
  danger: 'bg-danger/10 text-danger border-transparent',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-semibold"
    :class="tones[tone]"
  >
    <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-current" />
    {{ label }}
  </span>
</template>
