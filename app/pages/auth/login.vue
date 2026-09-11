<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ public: true })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const remember = ref(false)
const pending = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    await auth.login(email.value, password.value, remember.value)
    const redirect = typeof route.query.redirect === 'string'
      ? route.query.redirect
      : '/'
    await router.replace(redirect)
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    error.value = data?.message ?? 'Unable to sign in. Please try again.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h1 class="text-2xl font-semibold text-gray-900 mb-1">
        Victorious Children SMS
      </h1>
      <p class="text-sm text-gray-500 mb-6">Sign in to your account</p>

      <form v-if="!auth.isAuthenticated" class="space-y-4" @submit.prevent="onSubmit">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="username"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="you@school.edu"
          >
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="••••••••"
          >
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input v-model="remember" type="checkbox" class="rounded border-gray-300">
          Remember me
        </label>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="pending"
          class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p v-else class="text-sm text-gray-600">
        You are already signed in.
        <NuxtLink to="/" class="text-blue-600 hover:underline">Go to dashboard</NuxtLink>
      </p>
    </div>
  </div>
</template>
