<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'danger' | 'warning'
  }>(),
  {
    tone: 'neutral',
  },
)

const toneClasses: Record<string, string> = {
  neutral: 'bg-slate-100 text-content-muted',
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="toneClasses[tone]"
  >
    <slot />
  </span>
</template>
