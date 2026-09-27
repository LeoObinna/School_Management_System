<script setup lang="ts">
/**
 * Parent portal — fees & payments (Phase 16B). Reuses the Phase 15
 * BillingPanel (Paystack checkout, QR, bank details, receipts); the
 * child switcher is built into the panel.
 */
definePageMeta({ layout: 'portal', permissions: ['invoices.view'] })
</script>

<template>
  <div class="-mx-4 -my-8">
    <BillingPanel />
  </div>
</template>
