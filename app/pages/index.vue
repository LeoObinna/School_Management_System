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

      <section
        v-if="
          auth.can('students.view') ||
          auth.can('parents.view') ||
          auth.can('teachers.view') ||
          auth.can('staff.view') ||
          auth.can('enrollments.create')
        "
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">People</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <NuxtLink
            v-if="auth.can('students.view')"
            to="/students"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Students</p>
            <p class="mt-1 text-sm text-gray-500">Records, guardians and enrollment</p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('parents.view')"
            to="/parents"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Parents</p>
            <p class="mt-1 text-sm text-gray-500">Guardian directory</p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('teachers.view')"
            to="/teachers"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Teachers</p>
            <p class="mt-1 text-sm text-gray-500">Teaching staff</p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('staff.view')"
            to="/staff"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Staff</p>
            <p class="mt-1 text-sm text-gray-500">Non-teaching staff</p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('enrollments.view') || auth.can('enrollments.create')"
            to="/enrollments"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Enrollments</p>
            <p class="mt-1 text-sm text-gray-500">Student class placement</p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="
          auth.can('academic_sessions.view') ||
          auth.can('classes.view') ||
          auth.can('subjects.view') ||
          auth.can('teacher_assignments.manage')
        "
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Academics</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-if="auth.can('academic_sessions.view')"
            to="/academics/sessions"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Sessions &amp; terms</p>
            <p class="mt-1 text-sm text-gray-500">
              Academic calendar and current term
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('classes.view')"
            to="/academics/classes"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Classes &amp; sections</p>
            <p class="mt-1 text-sm text-gray-500">
              Class structure, sections and offered subjects
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('subjects.view')"
            to="/academics/subjects"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Subjects</p>
            <p class="mt-1 text-sm text-gray-500">
              School subject catalogue
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('teacher_assignments.manage')"
            to="/academics/assignments"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Teacher assignments</p>
            <p class="mt-1 text-sm text-gray-500">
              Teacher subjects and class allocations
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('timetable.view') || auth.can('attendance.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Schedule</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-if="auth.can('timetable.view')"
            to="/timetable"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Timetable</p>
            <p class="mt-1 text-sm text-gray-500">
              Weekly lessons, rooms and conflict checks
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('attendance.view')"
            to="/attendance"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Attendance</p>
            <p class="mt-1 text-sm text-gray-500">
              Daily registers, approval and reports
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('assignments.view') || auth.can('resources.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Teaching</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-if="auth.can('assignments.view')"
            to="/assignments"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Assignments</p>
            <p class="mt-1 text-sm text-gray-500">
              Set work, submit, grade and track feedback
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('resources.view')"
            to="/resources"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Resources</p>
            <p class="mt-1 text-sm text-gray-500">
              Shared documents and learning materials
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('fees.view') || auth.can('invoices.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Finance</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-if="auth.can('fees.view')"
            to="/finance/fees"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Fees</p>
            <p class="mt-1 text-sm text-gray-500">
              Fee structures and fee items per session and class
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('invoices.view')"
            to="/finance/invoices"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Invoices &amp; payments</p>
            <p class="mt-1 text-sm text-gray-500">
              Issue invoices, verify payments and refunds
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('invoices.view')"
            to="/billing"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">My billing</p>
            <p class="mt-1 text-sm text-gray-500">
              Student and parent view of invoices and receipts
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('admissions.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Admissions</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            to="/admissions"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Applications</p>
            <p class="mt-1 text-sm text-gray-500">
              Intake, documents, assessments, decisions and enrollment
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('announcements.view') || auth.can('notifications.view') || auth.can('messages.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          Communication
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-if="auth.can('announcements.view')"
            to="/announcements"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Announcements</p>
            <p class="mt-1 text-sm text-gray-500">
              Draft, publish and archive school-wide notices
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('notifications.view')"
            to="/notifications"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Notifications</p>
            <p class="mt-1 text-sm text-gray-500">
              View and manage your personal notifications
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('messages.view')"
            to="/messages"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Messages</p>
            <p class="mt-1 text-sm text-gray-500">
              Internal messaging between staff and users
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('events.view') || auth.can('gallery.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          Events &amp; gallery
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NuxtLink
            v-if="auth.can('events.view')"
            to="/events"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Events</p>
            <p class="mt-1 text-sm text-gray-500">
              School events with audience targeting
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('gallery.view')"
            to="/gallery"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Gallery</p>
            <p class="mt-1 text-sm text-gray-500">
              Photo albums with R2-backed images
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('reports.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Reports</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NuxtLink
            to="/reports"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Operational reports</p>
            <p class="mt-1 text-sm text-gray-500">
              Overview counts, attendance and enrollment reports, CSV exports
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('audit_logs.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 class="text-lg font-medium text-gray-900 mb-4">Audit logs</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NuxtLink
            to="/audit-logs"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Audit log viewer</p>
            <p class="mt-1 text-sm text-gray-500">
              Security and sensitive-operation events with CSV export
            </p>
          </NuxtLink>
        </div>
      </section>

      <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">System Health</h3>
        <HealthStatus />
      </section>
    </main>
  </div>
</template>
