<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { studentsApi } from '~/services/students'
import { formatApiError } from '~/utils/errors'
import type { StudentSelf } from '~/shared/types'

definePageMeta({ permissions: ['dashboard.view'] })

useHead({ title: 'My Dashboard — Student' })

const auth = useAuthStore()
const loading = ref(true)
const loadError = ref<string | null>(null)
const me = ref<StudentSelf | null>(null)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    me.value = await studentsApi.getMe()
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
      Your account is not linked to a student profile. Contact an administrator if you believe this is an error.
    </div>
    <div v-else class="space-y-6">
      <!-- Profile card -->
      <section
        class="bg-white rounded-lg shadow p-6 flex items-center gap-4"
      >
        <div
          class="h-16 w-16 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold"
        >
          {{ (me.profile.firstName[0] ?? '') + (me.profile.lastName[0] ?? '') }}
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-gray-900">
            {{ me.profile.firstName }} {{ me.profile.lastName }}
          </h2>
          <p class="text-sm text-gray-600">
            Admission #{{ me.profile.admissionNumber }}
          </p>
          <p v-if="me.activeEnrollment" class="text-sm text-gray-600">
            {{ me.activeEnrollment.className
            }}<span v-if="me.activeEnrollment.sectionName">
              — {{ me.activeEnrollment.sectionName }}</span
            >
            · {{ me.activeEnrollment.sessionName }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-indigo-600">
            {{ me.todayTimetable.length }}
          </p>
          <p class="text-xs uppercase tracking-wide text-gray-500">
            Period{{ me.todayTimetable.length === 1 ? '' : 's' }} today
          </p>
        </div>
      </section>

      <!-- Quick stats -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NuxtLink
          to="/timetable"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-indigo-600">
            {{ me.todayTimetable.length }}
          </p>
          <p class="text-sm text-gray-700 mt-1">Today's Periods</p>
        </NuxtLink>
        <NuxtLink
          to="/my/assignments"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-indigo-600">
            {{ me.pendingAssignments.length }}
          </p>
          <p class="text-sm text-gray-700 mt-1">Pending Assignments</p>
        </NuxtLink>
        <NuxtLink
          to="/results"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-indigo-600">Results</p>
          <p class="text-sm text-gray-700 mt-1">View published results</p>
        </NuxtLink>
      </section>

      <!-- Today's timetable -->
      <section
        v-if="me.todayTimetable.length"
        class="bg-white rounded-lg shadow p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Today's Timetable
        </h3>
        <ul class="divide-y divide-gray-200">
          <li
            v-for="entry in me.todayTimetable"
            :key="entry.id"
            class="py-2 flex justify-between"
          >
            <div>
              <p class="font-medium text-gray-900">
                {{ entry.className
                }}<span v-if="entry.sectionName"> — {{ entry.sectionName }}</span>
              </p>
              <p class="text-sm text-gray-600">
                {{ entry.subjectName
                }}<span v-if="entry.teacherName"> · {{ entry.teacherName }}</span>
              </p>
            </div>
            <p class="text-sm text-gray-500">
              {{ entry.startTime }} – {{ entry.endTime }}
            </p>
          </li>
        </ul>
      </section>

      <!-- Pending assignments -->
      <section
        v-if="me.pendingAssignments.length"
        class="bg-white rounded-lg shadow p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            Pending Assignments
          </h3>
          <NuxtLink
            to="/my/assignments"
            class="text-sm text-indigo-600 hover:underline"
          >
            View all →
          </NuxtLink>
        </div>
        <ul class="divide-y divide-gray-200">
          <li
            v-for="a in me.pendingAssignments"
            :key="a.id"
            class="py-2 flex justify-between"
          >
            <div>
              <p class="font-medium text-gray-900">{{ a.title }}</p>
              <p class="text-sm text-gray-600">
                {{ a.className }} · {{ a.subjectName }}
              </p>
            </div>
            <p class="text-sm text-gray-500">
              Due {{ a.dueDate ?? '—' }}
            </p>
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
            class="border-l-4 border-indigo-500 pl-3"
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
