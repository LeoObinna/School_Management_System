<script setup lang="ts">
/**
 * GalleryLightbox — full-screen image viewer for a public album
 * (Phase 18B). v-model:index controls the open image (null = closed).
 * Escape closes; ←/→ move between images; focus lands on the close
 * button when opened. Images stream from the public route URLs.
 */
import type { PublicImage } from '~/shared/types'

const props = defineProps<{ images: PublicImage[] }>()
const index = defineModel<number | null>({ required: true })

const current = computed(() =>
  index.value === null ? null : (props.images[index.value] ?? null),
)

function close() {
  index.value = null
}
function step(delta: number) {
  if (index.value === null || props.images.length === 0) return
  const next = (index.value + delta + props.images.length) % props.images.length
  index.value = next
}

const closeButton = ref<HTMLButtonElement | null>(null)
watch(
  () => index.value !== null,
  async (open) => {
    if (!import.meta.client) return
    if (open) {
      document.body.style.overflow = 'hidden'
      await nextTick()
      closeButton.value?.focus()
    } else {
      document.body.style.overflow = ''
    }
  },
)
onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})

function onKeydown(event: KeyboardEvent) {
  if (index.value === null) return
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === 'ArrowRight') step(1)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="current"
      class="fixed inset-0 z-[70] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      :aria-label="current.caption || current.fileName"
      @click.self="close"
    >
      <div class="flex items-center justify-between p-4">
        <p class="text-body-sm text-white/80">
          {{ (index ?? 0) + 1 }} / {{ images.length }}
        </p>
        <button
          ref="closeButton"
          type="button"
          class="rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          aria-label="Close viewer"
          @click="close"
        >
          ✕
        </button>
      </div>
      <div
        class="flex min-h-0 flex-1 items-center justify-center px-4"
        @click.self="close"
      >
        <img
          :src="current.url"
          :alt="current.caption || current.fileName"
          class="max-h-full max-w-full rounded-md object-contain"
        >
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <button
          type="button"
          class="rounded-md px-4 py-2 text-button text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          @click="step(-1)"
        >
          ← Previous
        </button>
        <p
          v-if="current.caption"
          class="min-w-0 flex-1 truncate text-center text-body-sm text-white/80"
        >
          {{ current.caption }}
        </p>
        <span v-else class="flex-1" />
        <button
          type="button"
          class="rounded-md px-4 py-2 text-button text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          @click="step(1)"
        >
          Next →
        </button>
      </div>
    </div>
  </Teleport>
</template>
