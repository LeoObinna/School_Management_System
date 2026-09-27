<script setup lang="ts">
/**
 * Role-portal shell (Phase 16A). Applied explicitly via
 * definePageMeta({ layout: 'portal' }). Branded from the public school
 * settings; navigation is scoped to the caller's primary portal role
 * (see utils/portal.ts) so no staff/admin navigation leaks into the
 * student/parent/teacher portals.
 */
import { useAuthStore } from '~/stores/auth'
import { schoolSettingsApi } from '~/services/school-settings'
import { primaryPortalRole, type PortalRole } from '~/utils/portal'
import type { SchoolPublicSettings } from '~/shared/types'

const auth = useAuthStore()
const router = useRouter()

const settings = ref<SchoolPublicSettings | null>(null)

const ROLE_LABELS: Record<PortalRole, string> = {
  student: 'Student portal',
  parent: 'Parent portal',
  teacher: 'Teacher portal',
}

const PORTAL_NAV: Record<PortalRole, Array<{ to: string; label: string }>> = {
  student: [
    { to: '/portal/student', label: 'Dashboard' },
    { to: '/portal/student/resources', label: 'Resources' },
    { to: '/portal/student/enrollment', label: 'Enrollment' },
  ],
  parent: [
    { to: '/portal/parent', label: 'Dashboard' },
    { to: '/portal/parent/attendance', label: 'Attendance' },
    { to: '/portal/parent/fees', label: 'Fees' },
    { to: '/portal/parent/report-cards', label: 'Report cards' },
    { to: '/portal/parent/messages', label: 'Messages' },
  ],
  teacher: [
    { to: '/portal/teacher', label: 'Dashboard' },
    { to: '/portal/teacher/attendance', label: 'Attendance' },
    { to: '/portal/teacher/scores', label: 'Scores' },
    { to: '/portal/teacher/lesson-notes', label: 'Notes' },
    { to: '/portal/teacher/performance', label: 'Performance' },
  ],
}

const role = computed(() => primaryPortalRole(auth.roles))
const nav = computed(() => (role.value ? PORTAL_NAV[role.value] : []))
const roleLabel = computed(() =>
  role.value ? ROLE_LABELS[role.value] : 'Portal',
)
const logoSrc = computed(() =>
  settings.value?.logoKey ? schoolSettingsApi.logoUrl() : null,
)

async function onLogout() {
  await auth.logout()
  await router.replace('/auth/login')
}

onMounted(async () => {
  // Branding is best-effort; the shell still works with the fallback name.
  try {
    settings.value = await schoolSettingsApi.getPublic()
  } catch {
    settings.value = null
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface-subtle text-text-primary">
    <a
      href="#portal-main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:text-text-inverse"
    >
      Skip to main content
    </a>

    <header class="border-b border-border-default bg-surface">
      <div
        class="mx-auto flex w-full max-w-content flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
      >
        <NuxtLink to="/" class="flex items-center gap-3">
          <img
            v-if="logoSrc"
            :src="logoSrc"
            alt=""
            class="h-9 w-9 rounded-full object-cover"
          >
          <span>
            <span
              class="block font-display text-lg font-semibold uppercase tracking-wide text-brand-primary"
            >
              {{ settings?.name ?? 'Victorious Children School' }}
            </span>
            <span class="block text-xs text-text-muted">{{ roleLabel }}</span>
          </span>
        </NuxtLink>

        <nav class="flex items-center gap-1 text-sm" aria-label="Portal">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-md px-3 py-1.5 text-text-secondary hover:bg-surface-muted hover:text-brand-primary"
            exact-active-class="bg-surface-muted font-medium text-brand-primary"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <span class="hidden text-sm text-text-muted sm:block">
            {{ auth.user?.email }}
          </span>
          <button
            type="button"
            class="rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            @click="onLogout"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <main
      id="portal-main"
      tabindex="-1"
      class="mx-auto w-full max-w-content flex-1 px-4 py-8 focus:outline-none"
    >
      <slot />
    </main>
  </div>
</template>
