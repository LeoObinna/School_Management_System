<script setup lang="ts">
/**
 * FaqAccordion — accessible disclosure list for the public contact page
 * (Phase 18C). Native button + region semantics; one open item at a time.
 */
defineProps<{
  items: { question: string; answer: string }[]
}>()

const openIndex = ref<number | null>(null)

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<template>
  <div class="divide-y divide-border rounded-lg border border-border bg-surface">
    <div v-for="(item, i) in items" :key="item.question">
      <h3>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-body font-semibold text-text-primary transition-colors duration-[var(--duration-fast)] hover:text-brand-primary"
          :aria-expanded="openIndex === i"
          :aria-controls="`faq-panel-${i}`"
          @click="toggle(i)"
        >
          {{ item.question }}
          <span aria-hidden="true" class="text-brand-accent">
            {{ openIndex === i ? '−' : '+' }}
          </span>
        </button>
      </h3>
      <div
        v-show="openIndex === i"
        :id="`faq-panel-${i}`"
        role="region"
        class="px-5 pb-4 text-body-sm text-text-secondary"
      >
        {{ item.answer }}
      </div>
    </div>
  </div>
</template>
