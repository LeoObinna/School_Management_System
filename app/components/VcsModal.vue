<script setup lang="ts">
/**
 * VcsModal — design-system dialog (08 §51).
 *
 * - Teleported to <body>; labelled via the title (aria-labelledby).
 * - Escape + backdrop close; body scroll locked while open.
 * - Focus moves to the close button on open, is trapped inside the
 *   dialog, and returns to the trigger on close.
 * - Long workflows should NOT use this — use a dedicated page
 *   (08 §51).
 */
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    size?: 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const titleId = `vcs-modal-title-${useId()}`
let previouslyFocused: HTMLElement | null = null

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function requestClose(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    requestClose()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return

  const focusables = Array.from(
    panel.value.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)

  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      panel.value
        ?.querySelector<HTMLElement>('[data-autofocus]')
        ?.focus()
    } else {
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-neutral-900/60 p-4 py-8 sm:p-8"
      @click.self="requestClose"
    >
      <div
        ref="panel"
        class="w-full rounded-lg bg-surface shadow-lg"
        :class="size === 'lg' ? 'max-w-3xl' : 'max-w-lg'"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header
          class="flex items-center justify-between gap-4 border-b border-border-default px-6 py-4"
        >
          <h2
            v-if="title"
            :id="titleId"
            class="text-h5 text-text-primary"
          >
            {{ title }}
          </h2>
          <slot v-else name="title" />
          <button
            type="button"
            data-autofocus
            class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle hover:text-text-primary"
            aria-label="Close dialog"
            @click="requestClose"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="px-6 py-5">
          <slot />
        </div>

        <footer
          v-if="$slots.footer"
          class="flex justify-end gap-3 border-t border-border-default px-6 py-4"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
