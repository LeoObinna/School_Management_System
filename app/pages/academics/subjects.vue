<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { usePaginated } from '~/composables/usePaginated'
import { formatApiError } from '~/utils/errors'
import type { Subject } from '~/shared/types'

definePageMeta({ permissions: ['subjects.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('subjects.manage'))

const { items, total, loading, error, load } = usePaginated<Subject>(
  academicsApi.listSubjects,
)
const includeInactive = ref(false)

const modalOpen = ref(false)
const editing = ref<Subject | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  name: '',
  code: '',
  description: '',
})

async function refresh() {
  await load({
    perPage: 100,
    ...(includeInactive.value ? {} : { isActive: true }),
  })
}

function openCreate() {
  editing.value = null
  formError.value = null
  Object.assign(form, { name: '', code: '', description: '' })
  modalOpen.value = true
}

function openEdit(subject: Subject) {
  editing.value = subject
  formError.value = null
  Object.assign(form, {
    name: subject.name,
    code: subject.code ?? '',
    description: subject.description ?? '',
  })
  modalOpen.value = true
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    const body = {
      name: form.name,
      ...(form.code ? { code: form.code } : {}),
      ...(form.description ? { description: form.description } : {}),
    }
    if (editing.value) {
      await academicsApi.updateSubject(editing.value.id, body)
    } else {
      await academicsApi.createSubject(body)
    }
    modalOpen.value = false
    await refresh()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

async function deactivate(subject: Subject) {
  if (!confirm(`Deactivate subject "${subject.name}"?`)) {
    return
  }
  try {
    await academicsApi.deactivateSubject(subject.id)
    await refresh()
  } catch (e) {
    alert(formatApiError(e))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <NuxtLink to="/" class="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </NuxtLink>
        <h1 class="mt-1 text-2xl font-semibold text-gray-900">Subjects</h1>
        <p class="text-sm text-gray-500">{{ total }} subject(s)</p>
      </div>
      <button
        v-if="canManage"
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New subject
      </button>
    </div>

    <label class="mb-4 inline-flex items-center gap-2 text-sm text-gray-600">
      <input v-model="includeInactive" type="checkbox" class="rounded" @change="refresh" />
      Show inactive
    </label>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
      <button type="button" class="ml-2 underline" @click="refresh">Retry</button>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Code</th>
            <th class="px-4 py-3">Status</th>
            <th v-if="canManage" class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              Loading…
            </td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500">
              No subjects yet.
            </td>
          </tr>
          <tr v-for="subject in items" v-else :key="subject.id">
            <td class="px-4 py-3">
              <p class="font-medium text-gray-900">{{ subject.name }}</p>
              <p class="text-xs text-gray-500">{{ subject.description }}</p>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ subject.code || '—' }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  subject.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                "
              >
                {{ subject.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td v-if="canManage" class="px-4 py-3 text-right">
              <button
                type="button"
                class="mr-3 text-indigo-600 hover:underline"
                @click="openEdit(subject)"
              >
                Edit
              </button>
              <button
                v-if="subject.isActive"
                type="button"
                class="text-red-600 hover:underline"
                @click="deactivate(subject)"
              >
                Deactivate
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UiBaseModal
      :open="modalOpen"
      :title="editing ? 'Edit subject' : 'New subject'"
      @close="modalOpen = false"
    >
      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ formError }}
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <input
            v-model="form.name"
            required
            maxlength="150"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Code</label>
          <input
            v-model="form.code"
            maxlength="50"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            maxlength="2000"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
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
  </div>
</template>
