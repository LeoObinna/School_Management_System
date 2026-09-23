<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { usersApi, rolesApi } from '~/services/users'
import { formatApiError } from '~/utils/errors'
import type { RoleDetail, RoleListItem, UserDetail } from '~/shared/types'

definePageMeta({ permissions: ['roles.view'] })

const auth = useAuthStore()

const roles = ref<RoleListItem[]>([])
const expanded = ref<Record<string, boolean>>({})
const loading = ref(false)
const error = ref<string | null>(null)

// User lookup state
const lookupId = ref('')
const lookupResult = ref<UserDetail | null>(null)
const lookupLoading = ref(false)
const lookupError = ref<string | null>(null)
const roleDetailsCache = ref<Record<string, RoleDetail>>({})

async function loadRoles() {
  loading.value = true
  error.value = null
  try {
    const res = await rolesApi.listRoles()
    roles.value = res.data
    // Expand the first role by default so the page isn't empty.
    if (roles.value.length > 0) {
      expanded.value[roles.value[0]!.id] = true
    }
  } catch (e) {
    error.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

async function toggleExpand(role: RoleListItem) {
  const open = !expanded.value[role.id]
  expanded.value[role.id] = open
  if (open && !roleDetailsCache.value[role.id]) {
    try {
      roleDetailsCache.value[role.id] = await rolesApi.getRole(role.id)
    } catch (e) {
      error.value = formatApiError(e)
    }
  }
}

function permissionsByGroup(
  detail: RoleDetail | undefined,
): { group: string; items: { slug: string; name: string }[] }[] {
  if (!detail) return []
  const map = new Map<string, { slug: string; name: string }[]>()
  for (const p of detail.permissions) {
    const g = p.group || 'misc'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push({ slug: p.slug, name: p.name })
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }))
}

async function lookup() {
  const id = lookupId.value.trim()
  if (!id) return
  lookupLoading.value = true
  lookupError.value = null
  lookupResult.value = null
  try {
    // Treat input as a user id (UUID). If it's not a UUID, the API
    // will return 422 — we show the formatted error.
    lookupResult.value = await usersApi.getUser(id)
  } catch (e) {
    lookupError.value = formatApiError(e)
  } finally {
    lookupLoading.value = false
  }
}

onMounted(loadRoles)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline"
        >← Dashboard</NuxtLink
      >
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">
        Roles &amp; permissions
      </h1>
      <p class="mt-1 text-sm text-gray-500">
        Read-only view of the system's 5 roles and their permission grants.
        Role definitions are seeded and not editable here.
      </p>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <section class="mb-8 space-y-3">
      <h2 class="text-lg font-medium text-gray-900">System roles</h2>
      <div v-if="loading" class="text-sm text-gray-500">Loading…</div>
      <div v-else class="space-y-3">
        <div
          v-for="role in roles"
          :key="role.id"
          class="rounded-lg border border-gray-200 bg-white"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-left"
            @click="toggleExpand(role)"
          >
            <div>
              <p class="font-medium text-gray-900">
                {{ role.name }}
                <span
                  v-if="role.isSystem"
                  class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500"
                  >system</span
                >
              </p>
              <p class="text-xs text-gray-500">
                {{ role.slug }} · {{ role.permissionCount }} permission{{
                  role.permissionCount === 1 ? '' : 's'
                }}
              </p>
            </div>
            <span class="text-gray-400">{{
              expanded[role.id] ? '▲' : '▼'
            }}</span>
          </button>
          <div
            v-if="expanded[role.id]"
            class="border-t border-gray-100 px-4 py-3"
          >
            <p v-if="role.description" class="mb-3 text-sm text-gray-600">
              {{ role.description }}
            </p>
            <div
              v-for="group in permissionsByGroup(
                roleDetailsCache[role.id],
              )"
              :key="group.group"
              class="mb-3"
            >
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {{ group.group }}
              </p>
              <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                <li
                  v-for="p in group.items"
                  :key="p.slug"
                  class="text-sm text-gray-700"
                >
                  <code class="text-xs text-gray-500">{{ p.slug }}</code>
                  <span class="ml-1">— {{ p.name }}</span>
                </li>
              </ul>
            </div>
            <p
              v-if="!roleDetailsCache[role.id]"
              class="text-sm text-gray-400"
            >
              Loading permissions…
            </p>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="auth.can('users.view')"
      class="rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 class="mb-2 text-lg font-medium text-gray-900">
        Effective permissions lookup
      </h2>
      <p class="mb-3 text-sm text-gray-500">
        Paste a user id to view their effective roles and permission slugs.
      </p>
      <form class="flex items-end gap-2" @submit.prevent="lookup">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700"
            >User id</label
          >
          <input
            v-model="lookupId"
            type="text"
            placeholder="e.g. 3f1b…"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          type="submit"
          :disabled="lookupLoading"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {{ lookupLoading ? 'Looking up…' : 'Look up' }}
        </button>
      </form>

      <div
        v-if="lookupError"
        class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
      >
        {{ lookupError }}
      </div>

      <div v-if="lookupResult" class="mt-4 space-y-2">
        <div class="text-sm">
          <span class="text-gray-500">User:</span>
          <span class="ml-1 font-medium text-gray-900">{{
            lookupResult.name
          }}</span>
          <span class="ml-1 text-gray-500">({{ lookupResult.email }})</span>
        </div>
        <div class="text-sm">
          <span class="text-gray-500">Roles:</span>
          <span class="ml-1 text-gray-900">{{
            lookupResult.roles.join(', ') || '—'
          }}</span>
        </div>
        <div>
          <p class="text-sm text-gray-500">
            Permissions ({{ lookupResult.permissions.length }}):
          </p>
          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="p in lookupResult.permissions"
              :key="p"
              class="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              >{{ p }}</span
            >
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
