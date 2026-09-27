<script setup lang="ts">
/**
 * VcsButton — the single button primitive (08 §19–§20).
 *
 * Variants: primary | secondary | gold | danger | ghost
 * Sizes:    sm (36px compact) | md (44px default) | lg (48px)
 *
 * Renders NuxtLink for `to`, <a> for `href`, otherwise <button>.
 * Every async action should use `loading` (spinner + aria-busy +
 * click suppression). Do not place two competing primary buttons in
 * one small region (08 §20).
 */
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    to?: RouteLocationRaw
    href?: string
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
  },
)

const base =
  'inline-flex items-center justify-center gap-2 rounded-md text-button transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50'

const variants: Record<string, string> = {
  primary:
    'bg-brand-primary text-text-inverse shadow-sm hover:bg-primary-dark',
  secondary:
    'border border-brand-primary bg-surface text-brand-primary hover:bg-surface-subtle',
  gold: 'bg-brand-accent text-text-primary hover:opacity-90',
  danger: 'bg-brand-emphasis text-text-inverse hover:opacity-90',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
}

const sizes: Record<string, string> = {
  sm: 'h-9 px-3.5',
  md: 'h-11 px-5',
  lg: 'h-12 px-6',
}

const classes = computed(
  () =>
    `${base} ${variants[props.variant]} ${sizes[props.size]} ${props.block ? 'w-full' : ''}`,
)
</script>

<template>
  <NuxtLink
    v-if="to && !disabled"
    :to="to"
    :class="classes"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="btn-spinner" aria-hidden="true" />
    <slot />
  </NuxtLink>
  <a
    v-else-if="href && !disabled"
    :href="href"
    :class="classes"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="btn-spinner" aria-hidden="true" />
    <slot />
  </a>
  <button
    v-else
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="classes"
  >
    <span v-if="loading" class="btn-spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
/* 18px functional spinner; global reduced-motion rule stops it. */
.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 9999px;
  animation: vcs-spin 0.6s linear infinite;
}

@keyframes vcs-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
