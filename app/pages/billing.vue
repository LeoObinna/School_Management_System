<script setup lang="ts">
/**
 * Legacy billing page (Phase 15). The implementation moved to
 * components/BillingPanel.vue in Phase 16B so the parent portal
 * (pages/portal/parent/fees.vue) shares it; this page remains for
 * compatibility with existing links/bookmarks.
 */
definePageMeta({ permissions: ['invoices.view'] })
</script>

<template>
  <BillingPanel />
</template>
