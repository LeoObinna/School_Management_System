<script setup lang="ts">
/**
 * VcsSelect — labelled native select (08 §24). Native control keeps
 * keyboard/screen-reader behaviour; chevron is decorative. Same
 * label/description/error contract as VcsInput.
 */
import { computed, useId } from 'vue'
import type { VcsSelectOption } from './vcs/types'

const model = defineModel<string | number>({ required: true })

const props = withDefaults(
  defineProps<{
    label: string
    options: VcsSelectOption[]
    name?: string
    required?: boolean
    description?: string
    error?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  { required: false, disabled: false },
)

const uid = useId()
const selectId = computed(() => `vcs-select-${uid}`)
const descId = computed(() => (props.description ? `${selectId}-desc` : undefined))
const errorId = computed(() => (props.error ? `${selectId}-error` : undefined))
const describedBy = computed(() =>
  [descId.value, errorId.value].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="space-y-1.5">
    <label
      :for="selectId"
      class="block text-body-sm font-semibold text-text-primary"
    >
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only"> (required)</span>
    </label>

    <p v-if="description && !error" :id="descId" class="text-caption text-text-muted">
      {{ description }}
    </p>

    <div class="relative">
      <select
        :id="selectId"
        v-model="model"
        :name="name"
        :required="required"
        :disabled="disabled"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        class="h-11 w-full appearance-none rounded-md border bg-surface px-3.5 pr-10 text-body text-text-primary focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-subtle"
        :class="error
          ? 'border-danger focus:border-danger focus:ring-danger/30'
          : 'border-border-strong focus:border-brand-primary focus:ring-brand-primary/25'"
      >
        <option v-if="placeholder" value="" disabled>
          {{ placeholder }}
        </option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <svg
        class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>

    <p v-if="error" :id="errorId" class="text-body-sm text-danger">
      {{ error }}
    </p>
  </div>
</template>
