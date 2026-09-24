<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { parentsApi } from '~/services/parents'
import { formatApiError } from '~/utils/errors'
import { formatMoney } from '~/shared/utils/money'
import type { ParentSelf } from '~/shared/types'

definePageMeta({ permissions: ['dashboard.view'] })

useHead({ title: 'My Dashboard — Parent' })

const auth = useAuthStore()
const loading = ref(true)
const loadError = ref<string | null>(null)
const me = ref<ParentSelf | null>(null)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    me.value = await parentsApi.getMe()
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900">My Dashboard</h1>
      <p class="mt-1 text-sm text-gray-500">{{ auth.user?.name ?? '' }}</p>
    </div>

    <div
      v-if="loading"
      class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600"
    >
      Loading your dashboard…
    </div>
    <div
      v-else-if="loadError"
      class="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700"
    >
      {{ loadError }}
      <button class="ml-2 underline" @click="load">Retry</button>
    </div>
    <div
      v-else-if="!me"
      class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600"
    >
      Your account is not linked to a parent profile. Contact an administrator if you believe this is an error.
    </div>
    <div v-else class="space-y-6">
      <!-- Profile card -->
      <section class="bg-white rounded-lg shadow p-6 flex items-center gap-4">
        <div
          class="h-16 w-16 rounded-full bg-amber-600 text-white flex items-center justify-center text-xl font-bold"
        >
          {{ (me.profile.firstName[0] ?? '') + (me.profile.lastName[0] ?? '') }}
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-gray-900">
            {{ me.profile.firstName }} {{ me.profile.lastName }}
          </h2>
          <p v-if="me.profile.email" class="text-sm text-gray-600">
            {{ me.profile.email }}
          </p>
          <p v-if="me.profile.phone" class="text-sm text-gray-600">
            {{ me.profile.phone }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-amber-600">
            {{ me.children.length }}
          </p>
          <p class="text-xs uppercase tracking-wide text-gray-500">
            Child{{ me.children.length === 1 ? '' : 'ren' }}
          </p>
        </div>
      </section>

      <!-- Fees summary -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NuxtLink
          to="/billing"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-amber-600">
            {{ me.fees.outstandingInvoiceCount }}
          </p>
          <p class="text-sm text-gray-700 mt-1">Outstanding invoices</p>
        </NuxtLink>
        <NuxtLink
          to="/billing"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-amber-600">
            {{ me.fees.overdueInvoiceCount }}
          </p>
          <p class="text-sm text-gray-700 mt-1">Overdue</p>
        </NuxtLink>
        <NuxtLink
          to="/billing"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-amber-600">
            {{ formatMoney(me.fees.outstandingBalance) }}
          </p>
          <p class="text-sm text-gray-700 mt-1">Total outstanding</p>
        </NuxtLink>
      </section>

      <!-- Children -->
      <section class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">My Children</h3>
        <div v-if="!me.children.length" class="text-sm text-gray-500">
          No children linked to this account.
        </div>
        <ul v-else class="divide-y divide-gray-200">
          <li
            v-for="child in me.children"
            :key="child.studentId"
            class="py-3 flex items-center justify-between gap-4"
          >
            <div>
              <p class="font-medium text-gray-900">
                {{ child.firstName }} {{ child.lastName }}
              </p>
              <p class="text-sm text-gray-600">
                {{ child.admissionNumber }}
                <span v-if="child.currentClassName">
                  · {{ child.currentClassName
                  }}<span v-if="child.currentSectionName">
                    — {{ child.currentSectionName }}</span
                  >
                </span>
              </p>
            </div>
            <div class="flex gap-3 text-sm">
              <NuxtLink
                to="/results"
                class="text-amber-600 hover:underline"
              >
                Results
              </NuxtLink>
              <NuxtLink
                to="/attendance"
                class="text-amber-600 hover:underline"
              >
                Attendance
              </NuxtLink>
            </div>
          </li>
        </ul>
      </section>

      <!-- Recent announcements -->
      <section
        v-if="me.recentAnnouncements.length"
        class="bg-white rounded-lg shadow p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Recent Announcements
        </h3>
        <ul class="space-y-3">
          <li
            v-for="ann in me.recentAnnouncements"
            :key="ann.id"
            class="border-l-4 border-amber-500 pl-3"
          >
            <p class="font-medium text-gray-900">{{ ann.title }}</p>
            <p class="text-xs text-gray-500">
              {{ ann.authorName ?? 'School' }} · {{ ann.createdAt }}
            </p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
