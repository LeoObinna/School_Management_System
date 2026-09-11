<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
    <p class="text-5xl font-semibold text-brand-600">404</p>
    <p class="text-sm text-content-muted">The page you are looking for does not exist.</p>
    <RouterLink to="/">
      <BaseButton variant="secondary">Back to dashboard</BaseButton>
    </RouterLink>
  </div>
</template>
