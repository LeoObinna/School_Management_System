<script setup lang="ts">
/**
 * VcsInput — labelled text field (08 §24–§26).
 *
 * - Visible <label> always; required is marked and announced.
 * - description and error are wired with aria-describedby;
 *   aria-invalid flips on error.
 * - 44px default height, 16px text (no iOS zoom), 10px radius.
 */
import { computed, useId } from 'vue'

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    label: string
    type?: string
    name?: string
    required?: boolean
    description?: string
    error?: string
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search'
    disabled?: boolean
    readonly?: boolean
  }>(),
  { type: 'text', required: false, disabled: false, readonly: false },
)

const uid = useId()
const inputId = computed(() => `vcs-input-${uid}`)
const descId = computed(() => (props.description ? `${inputId}-desc` : undefined))
const errorId = computed(() => (props.error ? `${inputId}-error` : undefined))
const describedBy = computed(() =>
  [descId.value, errorId.value].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="space-y-1.5">
    <label
      :for="inputId"
      class="block text-body-sm font-semibold text-text-primary"
    >
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only"> (required)</span>
    </label>

    <p v-if="description && !error" :id="descId" class="text-caption text-text-muted">
      {{ description }}
    </p>

    <input
      :id="inputId"
      v-model="model"
      :type="type"
      :name="name"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      class="h-11 w-full rounded-md border bg-surface px-3.5 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-subtle"
      :class="error
        ? 'border-danger focus:border-danger focus:ring-danger/30'
        : 'border-border-strong focus:border-brand-primary focus:ring-brand-primary/25'"
    >

    <p v-if="error" :id="errorId" class="text-body-sm text-danger">
      {{ error }}
    </p>
  </div>
</template>
