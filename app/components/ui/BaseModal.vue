<script setup lang="ts">
/**
 * Accessible modal dialog used by academic admin screens. Closes on
 * Escape and backdrop click; body scroll is locked while open.
 */
const props = defineProps<{ open: boolean; title?: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.open,
  (open) => {
    if (import.meta.client) {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 py-8 sm:p-8"
      role="presentation"
      @click.self="emit('close')"
    >
      <div
        class="w-full rounded-xl bg-white shadow-xl"
        :class="wide ? 'max-w-3xl' : 'max-w-lg'"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header
          class="flex items-center justify-between border-b border-gray-200 px-5 py-4"
        >
          <h2 class="text-base font-semibold text-gray-900">
            {{ title }}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>
        <div class="px-5 py-4">
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
