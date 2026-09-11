<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200">
      <div class="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-900">
          Victorious Children SMS
        </h1>
        <span class="text-sm text-gray-500">Phase 0 — Foundation</span>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-12">
      <div class="max-w-2xl">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">
          School Management System
        </h2>
        <p class="text-gray-600 mb-8">
          Nuxt + Cloudflare Workers + PostgreSQL. The authenticated SMS is
          under construction. Business modules arrive in later phases.
        </p>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">System Health</h3>
          <HealthStatus />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import HealthStatus from '~/components/HealthStatus.vue'
</script>
