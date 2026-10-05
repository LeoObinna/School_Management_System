<script setup lang="ts">
/**
 * AlbumCard — one published gallery album (Phase 18B). The cover is the
 * album's public thumbnail URL; albums without images render a neutral
 * placeholder block. Emits `select` (the gallery page swaps in the album
 * detail view).
 */
import type { PublicAlbum } from '~/shared/types'

defineProps<{ album: PublicAlbum }>()
defineEmits<{ select: [album: PublicAlbum] }>()
</script>

<template>
  <button
    type="button"
    class="group overflow-hidden rounded-lg border border-border-default bg-surface text-left shadow-sm transition-shadow duration-[var(--duration-fast)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
    @click="$emit('select', album)"
  >
    <div class="aspect-[4/3] w-full overflow-hidden bg-surface-muted">
      <img
        v-if="album.coverUrl"
        :src="album.coverUrl"
        :alt="`Cover photo for the album ${album.title}`"
        class="h-full w-full object-cover transition-transform duration-[var(--duration-normal)] group-hover:scale-[1.02]"
        loading="lazy"
      >
    </div>
    <div class="p-4">
      <h3 class="font-display text-h5 text-brand-primary">
        {{ album.title }}
      </h3>
      <p class="mt-1 text-body-sm text-text-secondary">
        {{ album.imageCount }} photo{{ album.imageCount === 1 ? '' : 's' }}
        <template v-if="album.eventTitle"> • {{ album.eventTitle }}</template>
      </p>
    </div>
  </button>
</template>
