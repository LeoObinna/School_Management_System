<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { reportsApi } from '~/services/reports'
import { teachersApi } from '~/services/teachers'
import { studentsApi } from '~/services/students'
import { parentsApi } from '~/services/parents'
import { formatApiError } from '~/utils/errors'
import type {
  OverviewReport,
  ParentSelf,
  StudentSelf,
  TeacherSelf,
} from '~/shared/types'
import HealthStatus from '~/components/HealthStatus.vue'

const auth = useAuthStore()
const router = useRouter()

const overview = ref<OverviewReport | null>(null)
const overviewError = ref<string | null>(null)
const overviewLoading = ref(false)

const teacherSelf = ref<TeacherSelf | null>(null)
const studentSelf = ref<StudentSelf | null>(null)
const parentSelf = ref<ParentSelf | null>(null)

async function loadOverview() {
  if (!auth.can('reports.view')) return
  overviewLoading.value = true
  overviewError.value = null
  try {
    overview.value = await reportsApi.overview()
  } catch (e) {
    overviewError.value = formatApiError(e)
  } finally {
    overviewLoading.value = false
  }
}

/**
 * Best-effort fetch of the caller's teacher profile. The route 404s
 * when there is no linked teacher record (admins/students/parents),
 * which we treat as "no teacher widget" — not an error. Other errors
 * are silently dropped here so an unrelated network blip doesn't push
 * the admin dashboard offline.
 */
async function loadTeacherSelf() {
  if (!auth.can('dashboard.view')) return
  try {
    teacherSelf.value = await teachersApi.getMe()
  } catch {
    teacherSelf.value = null
  }
}

/**
 * Best-effort fetch of the caller's student profile. The route 404s
 * when there is no linked student record (admins/teachers/parents),
 * which we treat as "no student widget" — not an error. Mirrors the
 * teacher widget pattern so an unrelated network blip doesn't push
 * the dashboard offline.
 */
async function loadStudentSelf() {
  if (!auth.can('dashboard.view')) return
  try {
    studentSelf.value = await studentsApi.getMe()
  } catch {
    studentSelf.value = null
  }
}

/**
 * Best-effort fetch of the caller's parent profile. The route 404s
 * when there is no linked parent record (admins/teachers/students),
 * which we treat as "no parent widget" — not an error. Mirrors the
 * teacher/student widget pattern.
 */
async function loadParentSelf() {
  if (!auth.can('dashboard.view')) return
  try {
    parentSelf.value = await parentsApi.getMe()
  } catch {
    parentSelf.value = null
  }
}

async function onLogout() {
  await auth.logout()
  await router.replace('/auth/login')
}

onMounted(() => {
  void loadOverview()
  void loadTeacherSelf()
  void loadStudentSelf()
  void loadParentSelf()
})
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
        v-if="auth.can('dashboard.view') && teacherSelf"
        class="bg-white rounded-lg shadow-sm border border-indigo-200 p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            Your teaching dashboard
          </h3>
          <NuxtLink
            to="/teachers/me"
            class="text-sm text-indigo-600 hover:underline"
          >
            View my dashboard →
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NuxtLink
            to="/my-classes"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              My classes
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ teacherSelf.classes.length }}
            </p>
          </NuxtLink>
          <NuxtLink
            to="/timetable"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Today's periods
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ teacherSelf.todayTimetable.length }}
            </p>
          </NuxtLink>
          <NuxtLink
            to="/submissions/to-grade"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Submissions to grade
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ teacherSelf.pendingSubmissionsCount }}
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('dashboard.view') && studentSelf"
        class="bg-white rounded-lg shadow-sm border border-emerald-200 p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            Your student dashboard
          </h3>
          <NuxtLink
            to="/students/me"
            class="text-sm text-emerald-600 hover:underline"
          >
            View my dashboard →
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NuxtLink
            to="/timetable"
            class="rounded-lg border border-gray-200 p-4 hover:border-emerald-400 hover:bg-emerald-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Today's periods
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ studentSelf.todayTimetable.length }}
            </p>
          </NuxtLink>
          <NuxtLink
            to="/my/assignments"
            class="rounded-lg border border-gray-200 p-4 hover:border-emerald-400 hover:bg-emerald-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Pending assignments
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ studentSelf.pendingAssignments.length }}
            </p>
          </NuxtLink>
          <NuxtLink
            to="/results"
            class="rounded-lg border border-gray-200 p-4 hover:border-emerald-400 hover:bg-emerald-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              My results
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ studentSelf.activeEnrollment ? studentSelf.activeEnrollment.className : '—' }}
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('dashboard.view') && parentSelf"
        class="bg-white rounded-lg shadow-sm border border-amber-200 p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            Your parent dashboard
          </h3>
          <NuxtLink
            to="/parents/me"
            class="text-sm text-amber-600 hover:underline"
          >
            View my dashboard →
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NuxtLink
            to="/parents/me"
            class="rounded-lg border border-gray-200 p-4 hover:border-amber-400 hover:bg-amber-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              My children
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ parentSelf.children.length }}
            </p>
          </NuxtLink>
          <NuxtLink
            to="/billing"
            class="rounded-lg border border-gray-200 p-4 hover:border-amber-400 hover:bg-amber-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Outstanding invoices
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ parentSelf.fees.outstandingInvoiceCount }}
            </p>
          </NuxtLink>
          <NuxtLink
            to="/results"
            class="rounded-lg border border-gray-200 p-4 hover:border-amber-400 hover:bg-amber-50"
          >
            <p class="text-xs uppercase tracking-wide text-gray-500">
              Children's results
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-900">
              {{ parentSelf.children.length }}
            </p>
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="auth.can('reports.view')"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">School overview</h3>
          <button
            type="button"
            class="text-sm text-indigo-600 hover:underline"
            @click="loadOverview"
          >
            Refresh
          </button>
        </div>
        <div v-if="overviewLoading" class="text-sm text-gray-500">
          Loading…
        </div>
        <div
          v-else-if="overviewError"
          class="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {{ overviewError }}
        </div>
        <div v-else-if="overview" class="space-y-6">
          <div
            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            <div class="rounded-lg border border-gray-200 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500">
                Students
              </p>
              <p class="mt-1 text-2xl font-semibold text-gray-900">
                {{ overview.studentsTotal }}
              </p>
              <p class="mt-1 text-xs text-gray-500">
                {{ overview.studentsActive }} active ·
                {{ overview.studentsArchived }} archived
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500">
                Teachers
              </p>
              <p class="mt-1 text-2xl font-semibold text-gray-900">
                {{ overview.teachers }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500">
                Parents
              </p>
              <p class="mt-1 text-2xl font-semibold text-gray-900">
                {{ overview.parents }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500">
                Staff
              </p>
              <p class="mt-1 text-2xl font-semibold text-gray-900">
                {{ overview.staff }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500">
                Classes
              </p>
              <p class="mt-1 text-2xl font-semibold text-gray-900">
                {{ overview.classes }}
              </p>
              <p class="mt-1 text-xs text-gray-500">
                {{ overview.sections }} sections
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500">
                Subjects
              </p>
              <p class="mt-1 text-2xl font-semibold text-gray-900">
                {{ overview.subjects }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Enrollments by status
              </p>
              <ul class="text-sm text-gray-700 space-y-1">
                <li
                  v-for="n in [
                    { k: 'active', v: overview.enrollmentsByStatus.active },
                    { k: 'completed', v: overview.enrollmentsByStatus.completed },
                    { k: 'promoted', v: overview.enrollmentsByStatus.promoted },
                    { k: 'repeated', v: overview.enrollmentsByStatus.repeated },
                    { k: 'withdrawn', v: overview.enrollmentsByStatus.withdrawn },
                  ]"
                  :key="n.k"
                  class="flex justify-between"
                >
                  <span class="capitalize">{{ n.k }}</span>
                  <span class="font-medium text-gray-900">{{ n.v }}</span>
                </li>
              </ul>
            </div>
            <div>
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Announcements by status
              </p>
              <ul class="text-sm text-gray-700 space-y-1">
                <li
                  v-for="n in [
                    { k: 'draft', v: overview.announcementsByStatus.draft },
                    { k: 'scheduled', v: overview.announcementsByStatus.scheduled },
                    { k: 'published', v: overview.announcementsByStatus.published },
                    { k: 'archived', v: overview.announcementsByStatus.archived },
                  ]"
                  :key="n.k"
                  class="flex justify-between"
                >
                  <span class="capitalize">{{ n.k }}</span>
                  <span class="font-medium text-gray-900">{{ n.v }}</span>
                </li>
              </ul>
            </div>
            <div>
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Events
              </p>
              <ul class="text-sm text-gray-700 space-y-1">
                <li class="flex justify-between">
                  <span>Upcoming</span>
                  <span class="font-medium text-gray-900">{{
                    overview.eventsUpcoming
                  }}</span>
                </li>
                <li class="flex justify-between">
                  <span>Past</span>
                  <span class="font-medium text-gray-900">{{
                    overview.eventsPast
                  }}</span>
                </li>
              </ul>
              <NuxtLink
                to="/reports"
                class="mt-3 inline-block text-sm text-indigo-600 hover:underline"
              >
                Full reports →
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="
          auth.can('students.view') ||
          auth.can('parents.view') ||
          auth.can('teachers.view') ||
          auth.can('staff.view') ||
          auth.can('enrollments.create') ||
          auth.can('users.view') ||
          auth.can('roles.view')
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
          <NuxtLink
            v-if="auth.can('users.view')"
            to="/users"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">User accounts</p>
            <p class="mt-1 text-sm text-gray-500">
              Login accounts, roles and password reset
            </p>
          </NuxtLink>
          <NuxtLink
            v-if="auth.can('roles.view')"
            to="/roles"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Roles &amp; permissions</p>
            <p class="mt-1 text-sm text-gray-500">
              View the 5 system roles and their permission grants
            </p>
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
          <NuxtLink
            v-if="auth.can('documents.view')"
            to="/documents"
            class="rounded-lg border border-gray-200 p-4 hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p class="font-medium text-gray-900">Documents</p>
            <p class="mt-1 text-sm text-gray-500">
              School policies, letters, certificates and staff files
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
