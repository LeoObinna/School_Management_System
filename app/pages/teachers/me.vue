<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { teachersApi } from '~/services/teachers'
import { formatApiError } from '~/utils/errors'
import type { TeacherSelf } from '~/shared/types'

definePageMeta({ permissions: ['dashboard.view'] })

useHead({ title: 'My Dashboard — Teacher' })

const auth = useAuthStore()
const loading = ref(true)
const loadError = ref<string | null>(null)
const me = ref<TeacherSelf | null>(null)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    me.value = await teachersApi.getMe()
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

    <!-- Deep-link tab strip (Phase 7 Option B). Overview renders the
         widgets below; the other tabs navigate to their surfaces. -->
    <nav class="flex flex-wrap gap-1 border-b border-gray-200">
      <NuxtLink
        to="/teachers/me"
        class="px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-700"
      >
        Overview
      </NuxtLink>
      <NuxtLink
        to="/my-classes"
        class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900"
      >
        My Subjects
      </NuxtLink>
      <NuxtLink
        to="/attendance"
        class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900"
      >
        Attendance
      </NuxtLink>
      <NuxtLink
        to="/exam-results/enter"
        class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900"
      >
        Results
      </NuxtLink>
      <NuxtLink
        to="/timetable"
        class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900"
      >
        Timetable
      </NuxtLink>
    </nav>

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
      Your account is not linked to a teacher profile. Contact an administrator if you believe this is an error.
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
          <p class="text-sm text-gray-600">Staff #{{ me.profile.staffNumber }}</p>
          <p v-if="me.profile.specialization" class="text-sm text-gray-600">
            {{ me.profile.specialization }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-indigo-600">{{ me.classes.length }}</p>
          <p class="text-xs uppercase tracking-wide text-gray-500">
            Class{{ me.classes.length === 1 ? '' : 'es' }}
          </p>
        </div>
      </section>

      <!-- Quick stats -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NuxtLink
          to="/my-classes"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-indigo-600">{{ me.classes.length }}</p>
          <p class="text-sm text-gray-700 mt-1">My Classes</p>
        </NuxtLink>
        <NuxtLink
          to="/timetable"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-indigo-600">{{ me.todayTimetable.length }}</p>
          <p class="text-sm text-gray-700 mt-1">Today's Periods</p>
        </NuxtLink>
        <NuxtLink
          to="/submissions/to-grade"
          class="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
        >
          <p class="text-3xl font-bold text-indigo-600">{{ me.pendingSubmissionsCount }}</p>
          <p class="text-sm text-gray-700 mt-1">Submissions to Grade</p>
        </NuxtLink>
      </section>

      <!-- Today's timetable -->
      <section
        v-if="me.todayTimetable.length"
        class="bg-white rounded-lg shadow p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Today's Timetable</h3>
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
