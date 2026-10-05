<script setup lang="ts">
/**
 * Public news detail (Phase 18B). The body is rendered as plain text
 * (whitespace preserved) — never v-html. Drafts, targeted audiences and
 * unknown ids all land on the same not-found state.
 */
definePageMeta({ layout: 'public', public: true })

const route = useRoute()
const id = route.params.id as string

const { data: item } = await usePublicNewsItem(id)

usePublicSeo({
  title: item.value?.title ?? 'News',
  description:
    item.value?.body?.slice(0, 160) ??
    'News from Victorious Children School, Ojodu, Lagos.',
})
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-20 xl:px-8">
        <template v-if="item">
          <p
            v-if="item.publishedAt"
            class="text-label font-medium uppercase tracking-wide text-brand-accent"
          >
            {{ formatPublicDate(item.publishedAt) }}
          </p>
          <h1
            class="mt-3 max-w-4xl font-display text-h1 font-semibold text-brand-primary"
          >
            {{ item.title }}
          </h1>
        </template>
        <h1
          v-else
          class="font-display text-h1 font-semibold text-brand-primary"
        >
          News item not found
        </h1>
      </div>
    </section>

    <section class="bg-surface">
      <div class="mx-auto max-w-prose px-5 py-16 md:px-6 md:py-20">
        <template v-if="item">
          <p
            v-if="item.body"
            class="whitespace-pre-line text-body-lg text-text-primary"
          >
            {{ item.body }}
          </p>
        </template>
        <VcsEmptyState
          v-else
          title="This news item is not available"
          description="It may have been withdrawn, or the link may be incorrect."
        />
        <div class="mt-10">
          <VcsButton to="/news" variant="ghost">← Back to news</VcsButton>
        </div>
      </div>
    </section>
  </div>
</template>
