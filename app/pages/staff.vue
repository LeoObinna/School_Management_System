<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { peopleApi } from '~/services/people'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type { StaffProfile } from '~/shared/types'

definePageMeta({ permissions: ['staff.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('staff.create'))
const canUpdate = computed(() => auth.can('staff.update'))
const canDelete = computed(() => auth.can('staff.delete'))

const { items, total, loading, error, load } = usePaginated<StaffProfile>(peopleApi.listStaff)
const includeInactive = ref(false)

const modalOpen = ref(false)
const editing = ref<StaffProfile | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  staffNumber: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  jobTitle: '',
  department: '',
  email: '',
  phone: '',
  gender: '',
  hiredAt: '',
})

async function refresh() {
  await load({ perPage: 100, ...(includeInactive.value ? {} : { isActive: true }) })
}

function openCreate() {
  editing.value = null
  formError.value = null
  Object.assign(form, { staffNumber: '', firstName: '', lastName: '', otherNames: '', jobTitle: '', department: '', email: '', phone: '', gender: '', hiredAt: '' })
  modalOpen.value = true
}

function openEdit(staff: StaffProfile) {
  editing.value = staff
  formError.value = null
  Object.assign(form, {
    staffNumber: staff.staffNumber,
    firstName: staff.firstName,
    lastName: staff.lastName,
    otherNames: staff.otherNames ?? '',
    jobTitle: staff.jobTitle ?? '',
    department: staff.department ?? '',
    email: staff.email ?? '',
    phone: staff.phone ?? '',
    gender: staff.gender ?? '',
    hiredAt: staff.hiredAt ?? '',
  })
  modalOpen.value = true
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    const body = {
      staffNumber: form.staffNumber,
      firstName: form.firstName,
      lastName: form.lastName,
      ...(form.otherNames ? { otherNames: form.otherNames } : {}),
      ...(form.jobTitle ? { jobTitle: form.jobTitle } : {}),
      ...(form.department ? { department: form.department } : {}),
      ...(form.email ? { email: form.email } : {}),
      ...(form.phone ? { phone: form.phone } : {}),
      ...(form.gender ? { gender: form.gender as 'male' | 'female' | 'other' } : {}),
      ...(form.hiredAt ? { hiredAt: form.hiredAt } : {}),
    }
    if (editing.value) {
      await peopleApi.updateStaff(editing.value.id, body)
    } else {
      await peopleApi.createStaff(body)
    }
    modalOpen.value = false
    await refresh()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function deactivate(staff: StaffProfile) {
  if (!confirm(`Deactivate ${staff.firstName} ${staff.lastName}?`)) {
    return
  }
  try {
    await peopleApi.deactivateStaff(staff.id)
    await refresh()
  } catch (e) {
    alert(formatApiError(e))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">← Dashboard</NuxtLink>
      <h1 class="mt-1 text-2xl font-semibold text-gray-900">Staff (non-teaching)</h1>
    </div>

    <div class="mb-4 flex items-center justify-between">
      <label class="inline-flex items-center gap-2 text-sm text-gray-600">
        <input v-model="includeInactive" type="checkbox" class="rounded" @change="refresh" /> Show inactive
      </label>
      <button v-if="canCreate" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="openCreate">New staff</button>
    </div>

    <div v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
      <button type="button" class="ml-2 underline" @click="refresh">Retry</button>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3">Staff no.</th>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Role / dept</th>
            <th class="px-4 py-3">Contact</th>
            <th v-if="canUpdate || canDelete" class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading"><td colspan="5" class="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
          <tr v-else-if="items.length === 0"><td colspan="5" class="px-4 py-8 text-center text-gray-500">No staff.</td></tr>
          <tr v-for="staff in items" v-else :key="staff.id">
            <td class="px-4 py-3 text-gray-600">{{ staff.staffNumber }}</td>
            <td class="px-4 py-3 font-medium text-gray-900">{{ staff.firstName }} {{ staff.lastName }}</td>
            <td class="px-4 py-3 text-gray-600">{{ staff.jobTitle || '—' }}<span v-if="staff.department"> · {{ staff.department }}</span></td>
            <td class="px-4 py-3 text-gray-600">{{ staff.email || '—' }}</td>
            <td v-if="canUpdate || canDelete" class="px-4 py-3 text-right">
              <button v-if="canUpdate" type="button" class="mr-3 text-indigo-600 hover:underline" @click="openEdit(staff)">Edit</button>
              <button v-if="canDelete && staff.isActive" type="button" class="text-red-600 hover:underline" @click="deactivate(staff)">Deactivate</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UiBaseModal :open="modalOpen" :title="editing ? 'Edit staff' : 'New staff'" @close="modalOpen = false">
      <form class="space-y-3" @submit.prevent="submit">
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ formError }}</div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block text-sm font-medium text-gray-700">Staff number</label><input v-model="form.staffNumber" required maxlength="50" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700">First name</label><input v-model="form.firstName" required maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700">Last name</label><input v-model="form.lastName" required maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm font-medium text-gray-700">Job title</label><input v-model="form.jobTitle" maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700">Department</label><input v-model="form.department" maxlength="150" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block text-sm font-medium text-gray-700">Email</label><input v-model="form.email" type="email" maxlength="255" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700">Phone</label><input v-model="form.phone" maxlength="50" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
          <div><label class="block text-sm font-medium text-gray-700">Gender</label>
            <select v-model="form.gender" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700">Hired at</label><input v-model="form.hiredAt" type="date" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
      </form>
      <template #footer>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="modalOpen = false">Cancel</button>
        <button type="button" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60" @click="submit">{{ saving ? 'Saving…' : 'Save' }}</button>
      </template>
    </UiBaseModal>
  </div>
</template>
