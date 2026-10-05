<script setup lang="ts">
/**
 * Public news list (Phase 18B) — published, audience-all announcements.
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'News',
  description:
    'News and announcements from Victorious Children School, Ojodu, Lagos.',
  path: '/news',
})

const route = useRoute()
const page = computed(() => {
  const p = Number(route.query.page)
  return Number.isInteger(p) && p >= 1 ? p : 1
})

const { data: news } = await usePublicNews(page.value)

const items = computed(() => news.value?.data ?? [])
const meta = computed(() => news.value?.meta ?? null)
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsSectionHeader
          eyebrow="News"
          title="School news & announcements"
          description="Updates and stories from life at Victorious Children School."
        />
      </div>
    </section>

    <section class="bg-surface">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <VcsEmptyState
          v-if="items.length === 0"
          title="No news yet"
          description="Announcements and school stories will be published here. Check back soon."
        />
        <template v-else>
          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <NewsCard v-for="item in items" :key="item.id" :item="item" />
          </div>
          <nav
            v-if="meta && meta.lastPage > 1"
            class="mt-10 flex items-center justify-center gap-4"
            aria-label="News pages"
          >
            <VcsButton
              v-if="meta.currentPage > 1"
              :to="`/news?page=${meta.currentPage - 1}`"
              variant="secondary"
              size="sm"
            >
              ← Newer
            </VcsButton>
            <span class="text-body-sm text-text-secondary">
              Page {{ meta.currentPage }} of {{ meta.lastPage }}
            </span>
            <VcsButton
              v-if="meta.currentPage < meta.lastPage"
              :to="`/news?page=${meta.currentPage + 1}`"
              variant="secondary"
              size="sm"
            >
              Older →
            </VcsButton>
          </nav>
        </template>
      </div>
    </section>
  </div>
</template>
