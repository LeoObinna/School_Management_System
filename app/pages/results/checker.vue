<script setup lang="ts">
/**
 * Public result checker page (Phase 18D).
 *
 * Anonymous, identity-gated (admission number + surname + term); only
 * published results are shown. Session/terms come from the live
 * academics payload — no invented data.
 */
definePageMeta({ layout: 'public', public: true })

usePublicSeo({
  title: 'Check Results',
  description:
    'Check published termly results for students of Victorious Children School, Ojodu, Lagos.',
  path: '/results/checker',
})

const { data: academics, pending } = await usePublicAcademics()
</script>

<template>
  <div>
    <section class="bg-surface-muted">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <VcsSectionHeader
          eyebrow="Results"
          title="Check published results"
          description="Enter the student's admission number and surname and choose the term. Results appear here once the school has published them."
        />
      </div>
    </section>

    <section class="bg-surface-subtle">
      <div class="mx-auto max-w-content px-5 py-16 md:px-6 md:py-24 xl:px-8">
        <div class="mx-auto max-w-4xl">
          <VcsLoadingState v-if="pending" variant="cards" />
          <PublicResultChecker
            v-else
            :session="
              academics?.session
                ? { id: academics.session.id, name: academics.session.name }
                : null
            "
            :terms="(academics?.terms ?? []).map((t) => ({
              id: t.id,
              name: t.name,
            }))"
          />
        </div>

        <p class="mx-auto mt-8 max-w-4xl text-body-sm text-text-muted">
          Results are published per class and term. If you cannot find a
          published result, please contact the school office.
        </p>
      </div>
    </section>
  </div>
</template>
