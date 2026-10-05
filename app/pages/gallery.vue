<script setup lang="ts">
/**
 * Public gallery (Phase 18B) — published albums grid; selecting an album
 * swaps in its image grid (client-side fetch); selecting an image opens
 * the lightbox. Only published albums/images ever appear.
 */
import { fetchPublicAlbum } from '~/services/public'
import type { PublicAlbum, PublicAlbumDetail } from '~/shared/types'

definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Gallery',
  description:
    'Photos from classrooms, events and school life at Victorious Children School, Ojodu, Lagos.',
  path: '/gallery',
})

const { data: albums } = await usePublicAlbums()

const openAlbum = ref<PublicAlbumDetail | null>(null)
const albumLoading = ref(false)
const albumError = ref(false)
const lightboxIndex = ref<number | null>(null)

async function selectAlbum(album: PublicAlbum) {
  albumLoading.value = true
  albumError.value = false
  try {
    openAlbum.value = await fetchPublicAlbum(album.id)
  } catch {
    albumError.value = true
  } finally {
    albumLoading.value = false
  }
}

function backToAlbums() {
  openAlbum.value = null
  lightboxIndex.value = null
}
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsSectionHeader
          eyebrow="Gallery"
          title="Our community in pictures"
          description="Moments from classrooms, events and everyday school life."
        />
      </div>
    </section>

    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <!-- Album grid -->
        <template v-if="!openAlbum">
          <VcsEmptyState
            v-if="(albums?.data ?? []).length === 0"
            title="No albums yet"
            description="Photos from school life will appear here once albums are published."
          />
          <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AlbumCard
              v-for="album in albums!.data"
              :key="album.id"
              :album="album"
              @select="selectAlbum"
            />
          </div>
        </template>

        <!-- Album detail -->
        <template v-else>
          <div class="mb-8">
            <VcsButton variant="ghost" size="sm" @click="backToAlbums">
              ← All albums
            </VcsButton>
            <h2 class="mt-4 font-display text-h2 text-brand-primary">
              {{ openAlbum.title }}
            </h2>
            <p
              v-if="openAlbum.description"
              class="mt-2 max-w-prose text-body text-text-secondary"
            >
              {{ openAlbum.description }}
            </p>
          </div>
          <VcsEmptyState
            v-if="openAlbum.images.length === 0"
            title="No photos in this album yet"
          />
          <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="(image, i) in openAlbum.images"
              :key="image.id"
              type="button"
              class="group aspect-square overflow-hidden rounded-md bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              @click="lightboxIndex = i"
            >
              <img
                :src="image.thumbUrl"
                :alt="image.caption || image.fileName"
                class="h-full w-full object-cover transition-transform duration-[var(--duration-normal)] group-hover:scale-[1.03]"
                loading="lazy"
              >
            </button>
          </div>
        </template>

        <VcsLoadingState
          v-if="albumLoading"
          variant="cards"
          :count="3"
          label="Loading album"
          class="mt-6"
        />
        <VcsEmptyState
          v-if="albumError"
          title="This album could not be loaded"
          description="It may have been unpublished. Please pick another album."
        />
      </div>
    </section>

    <GalleryLightbox
      v-if="openAlbum"
      v-model:index="lightboxIndex"
      :images="openAlbum.images"
    />
  </div>
</template>
