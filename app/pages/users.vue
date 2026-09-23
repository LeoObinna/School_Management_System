<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { usersApi, rolesApi } from '~/services/users'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type { RoleListItem, UserListItem } from '~/shared/types'

definePageMeta({ permissions: ['users.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('users.create'))
const canUpdate = computed(() => auth.can('users.update'))
const canDelete = computed(() => auth.can('users.delete'))

const { items, total, loading, error, load } =
  usePaginated<UserListItem>(usersApi.listUsers)

const search = ref('')
const roleFilter = ref('')
const includeInactive = ref(false)
const allRoles = ref<RoleListItem[]>([])

// --- user modal (create / edit) -------------------------------------------
const modalOpen = ref(false)
const editing = ref<UserListItem | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  name: '',
  email: '',
  password: '',
  phone: '',
  gender: '',
  isActive: true,
})

// --- roles modal -----------------------------------------------------------
const rolesModalOpen = ref(false)
const rolesTarget = ref<UserListItem | null>(null)
const rolesChoices = ref<{ id: string; name: string; slug: string }[]>([])
const rolesSelected = ref<string[]>([])
const rolesSaving = ref(false)
const rolesError = ref<string | null>(null)

// --- reset password modal --------------------------------------------------
const resetModalOpen = ref(false)
const resetTarget = ref<UserListItem | null>(null)
const resetPassword = ref('')
const resetSaving = ref(false)
const resetError = ref<string | null>(null)

async function refresh() {
  await load({
    perPage: 100,
    ...(includeInactive.value ? {} : { isActive: true }),
    ...(roleFilter.value ? { role: roleFilter.value } : {}),
    ...(search.value ? { search: search.value } : {}),
  })
}

async function loadRoles() {
  try {
    const res = await rolesApi.listRoles()
    allRoles.value = res.data
  } catch {
    // Non-fatal — role picker still works without labels.
  }
}

function openCreate() {
  editing.value = null
  formError.value = null
  Object.assign(form, {
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    isActive: true,
  })
  modalOpen.value = true
}

function openEdit(user: UserListItem) {
  editing.value = user
  formError.value = null
  Object.assign(form, {
    name: user.name,
    email: user.email,
    password: '',
    phone: user.phone ?? '',
    gender: '',
    isActive: user.isActive,
  })
  modalOpen.value = true
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    const body: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      ...(form.phone ? { phone: form.phone } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      isActive: form.isActive,
    }
    if (form.password) {
      body.password = form.password
    }
    if (editing.value) {
      await usersApi.updateUser(editing.value.id, body)
    } else {
      if (!form.password) {
        throw new Error('Password is required when creating a user.')
      }
      await usersApi.createUser(body as never)
    }
    modalOpen.value = false
    await refresh()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function toggleActive(user: UserListItem) {
  const verb = user.isActive ? 'Deactivate' : 'Reactivate'
  if (!confirm(`${verb} ${user.email}?`)) return
  try {
    await usersApi.updateUser(user.id, { isActive: !user.isActive })
    await refresh()
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function softDelete(user: UserListItem) {
  if (
    !confirm(
      `Permanently deactivate ${user.email}? They will not be able to log in. This is reversible from the user record.`,
    )
  )
    return
  try {
    await usersApi.deleteUser(user.id)
    await refresh()
  } catch (e) {
    alert(formatApiError(e))
  }
}

async function openRoles(user: UserListItem) {
  rolesTarget.value = user
  rolesError.value = null
  rolesSelected.value = []
  rolesModalOpen.value = true
  try {
    // Lazy-load the picker choices once; admin-only.
    if (rolesChoices.value.length === 0) {
      // The list endpoint returns the 5 roles; reuse it as the picker.
      const res = await rolesApi.listRoles()
      rolesChoices.value = res.data.map((r: RoleListItem) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
      }))
    }
    // Pre-fill currently-assigned roles. We need role ids but the list
    // endpoint only gives us slugs; resolve them via the picker.
    const slugToId = new Map(rolesChoices.value.map((r) => [r.slug, r.id]))
    rolesSelected.value = user.roles
      .map((slug) => slugToId.get(slug))
      .filter((v): v is string => Boolean(v))
  } catch (e) {
    rolesError.value = formatApiError(e)
  }
}

async function submitRoles() {
  if (!rolesTarget.value) return
  if (rolesSelected.value.length === 0) {
    rolesError.value = 'Select at least one role.'
    return
  }
  rolesSaving.value = true
  rolesError.value = null
  try {
    await usersApi.setUserRoles(rolesTarget.value.id, {
      roleIds: rolesSelected.value,
    })
    rolesModalOpen.value = false
    await refresh()
  } catch (e) {
    rolesError.value = formatApiError(e)
  } finally {
    rolesSaving.value = false
  }
}

function openReset(user: UserListItem) {
  resetTarget.value = user
  resetPassword.value = ''
  resetError.value = null
  resetModalOpen.value = true
}

async function submitReset() {
  if (!resetTarget.value) return
  if (resetPassword.value.length < 8) {
    resetError.value = 'Password must be at least 8 characters.'
    return
  }
  resetSaving.value = true
  resetError.value = null
  try {
    await usersApi.resetUserPassword(resetTarget.value.id, {
      newPassword: resetPassword.value,
    })
    resetModalOpen.value = false
  } catch (e) {
    resetError.value = formatApiError(e)
  } finally {
    resetSaving.value = false
  }
}

function formatRoles(roles: string[]): string {
  return roles.length === 0 ? '—' : roles.join(', ')
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

onMounted(async () => {
  await Promise.all([refresh(), loadRoles()])
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline"
        >← Dashboard</NuxtLink
      >
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">User accounts</h1>
      <p class="mt-1 text-sm text-gray-500">
        Login accounts and role assignments. Total: {{ total }}
      </p>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Search by name or email…"
        class="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
        @change="refresh"
      />
      <select
        v-model="roleFilter"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        @change="refresh"
      >
        <option value="">All roles</option>
        <option v-for="r in allRoles" :key="r.id" :value="r.slug">
          {{ r.name }}
        </option>
      </select>
      <label
        class="inline-flex items-center gap-2 text-sm text-gray-600"
      >
        <input
          v-model="includeInactive"
          type="checkbox"
          class="rounded"
          @change="refresh"
        />
        Show inactive
      </label>
      <button
        v-if="canCreate"
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New user
      </button>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
      <button type="button" class="ml-2 underline" @click="refresh">
        Retry
      </button>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead
          class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"
        >
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Roles</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Last login</th>
            <th
              v-if="canUpdate || canDelete"
              class="px-4 py-3 text-right"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td
              colspan="6"
              class="px-4 py-8 text-center text-gray-500"
            >
              Loading…
            </td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td
              colspan="6"
              class="px-4 py-8 text-center text-gray-500"
            >
              No users.
            </td>
          </tr>
          <tr v-for="user in items" v-else :key="user.id">
            <td class="px-4 py-3 font-medium text-gray-900">
              {{ user.name }}
            </td>
            <td class="px-4 py-3 text-gray-600">{{ user.email }}</td>
            <td class="px-4 py-3 text-gray-600">
              {{ formatRoles(user.roles) }}
            </td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  user.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700',
                ]"
              >
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-600">
              {{ formatDate(user.lastLoginAt) }}
            </td>
            <td
              v-if="canUpdate || canDelete"
              class="px-4 py-3 text-right text-xs"
            >
              <button
                v-if="canUpdate"
                type="button"
                class="mr-3 text-indigo-600 hover:underline"
                @click="openEdit(user)"
              >
                Edit
              </button>
              <button
                v-if="canUpdate"
                type="button"
                class="mr-3 text-indigo-600 hover:underline"
                @click="openRoles(user)"
              >
                Roles
              </button>
              <button
                v-if="canUpdate"
                type="button"
                class="mr-3 text-indigo-600 hover:underline"
                @click="openReset(user)"
              >
                Reset password
              </button>
              <button
                v-if="canUpdate"
                type="button"
                class="mr-3 text-amber-600 hover:underline"
                @click="toggleActive(user)"
              >
                {{ user.isActive ? 'Deactivate' : 'Reactivate' }}
              </button>
              <button
                v-if="canDelete"
                type="button"
                class="text-red-600 hover:underline"
                @click="softDelete(user)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit user modal -->
    <UiBaseModal
      :open="modalOpen"
      :title="editing ? 'Edit user' : 'New user'"
      @close="modalOpen = false"
    >
      <form class="space-y-3" @submit.prevent="submit">
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ formError }}
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <input
            v-model="form.name"
            required
            maxlength="150"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input
            v-model="form.email"
            type="email"
            required
            maxlength="255"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">
            Password
            <span v-if="editing" class="font-normal text-gray-400"
              >(leave blank to keep current)</span
            >
          </label>
          <input
            v-model="form.password"
            type="password"
            :required="!editing"
            minlength="8"
            maxlength="256"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Phone</label>
            <input
              v-model="form.phone"
              maxlength="50"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700"
              >Gender</label
            >
            <select
              v-model="form.gender"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
          <input v-model="form.isActive" type="checkbox" class="rounded" />
          Active (can log in)
        </label>
      </form>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="modalOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="saving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submit"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </template>
    </UiBaseModal>

    <!-- Manage roles modal -->
    <UiBaseModal
      :open="rolesModalOpen"
      :title="rolesTarget ? `Roles — ${rolesTarget.email}` : 'Roles'"
      @close="rolesModalOpen = false"
    >
      <div class="space-y-2">
        <div v-if="rolesError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ rolesError }}
        </div>
        <p class="text-sm text-gray-500">
          Pick one or more roles. Replaces the user's current set.
        </p>
        <div
          v-for="role in rolesChoices"
          :key="role.id"
          class="flex items-start gap-2"
        >
          <label class="inline-flex items-center gap-2 text-sm text-gray-800">
            <input
              v-model="rolesSelected"
              :value="role.id"
              type="checkbox"
              class="rounded"
            />
            <span class="font-medium">{{ role.name }}</span>
            <span class="text-gray-400">({{ role.slug }})</span>
          </label>
        </div>
      </div>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="rolesModalOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="rolesSaving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submitRoles"
        >
          {{ rolesSaving ? 'Saving…' : 'Save roles' }}
        </button>
      </template>
    </UiBaseModal>

    <!-- Reset password modal -->
    <UiBaseModal
      :open="resetModalOpen"
      :title="
        resetTarget ? `Reset password — ${resetTarget.email}` : 'Reset password'
      "
      @close="resetModalOpen = false"
    >
      <div class="space-y-2">
        <div v-if="resetError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ resetError }}
        </div>
        <p class="text-sm text-gray-500">
          The user will be signed out of all devices and will need the new
          password to log in again.
        </p>
        <div>
          <label class="block text-sm font-medium text-gray-700"
            >New password</label
          >
          <input
            v-model="resetPassword"
            type="password"
            minlength="8"
            maxlength="256"
            required
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <template #footer>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="resetModalOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="resetSaving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          @click="submitReset"
        >
          {{ resetSaving ? 'Resetting…' : 'Reset password' }}
        </button>
      </template>
    </UiBaseModal>
  </div>
</template>
