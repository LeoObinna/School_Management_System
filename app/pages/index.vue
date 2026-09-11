<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import HealthStatus from '~/components/HealthStatus.vue'

const auth = useAuthStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  await router.replace('/auth/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200">
      <div class="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-900">
          Victorious Children SMS
        </h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-500">{{ auth.user?.email }}</span>
          <button
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            @click="onLogout"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">
          Welcome, {{ auth.user?.name }}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p class="text-gray-500">Roles</p>
            <p class="font-medium text-gray-900">
              {{ auth.roles.join(', ') || '—' }}
            </p>
          </div>
          <div>
            <p class="text-gray-500">Permissions</p>
            <p class="font-medium text-gray-900">
              {{ auth.permissions.length }} granted
            </p>
          </div>
          <div>
            <p class="text-gray-500">Example check</p>
            <p class="font-medium text-gray-900">
              students.view → {{ auth.can('students.view') ? 'yes' : 'no' }}
            </p>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">System Health</h3>
        <HealthStatus />
      </section>
    </main>
  </div>
</template>
