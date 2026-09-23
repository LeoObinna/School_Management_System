<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { financeApi } from '~/services/finance'
import { formatApiError } from '~/utils/errors'
import {
  formatMoney,
  koboToNaira,
  parseNairaToKobo,
} from '~/shared/utils/money'
import type {
  AcademicSession,
  FeeItem,
  FeeStructureDetail,
  SchoolClass,
} from '~/shared/types'
import type { FeeItemInput } from '~/shared/schemas'

definePageMeta({ permissions: ['fees.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('fees.manage_structure'))

// --- Reference data --------------------------------------------------------
const loading = ref(false)
const loadError = ref<string | null>(null)
const structures = ref<FeeStructureDetail[]>([])
const sessions = ref<AcademicSession[]>([])
const classes = ref<SchoolClass[]>([])
const sessionFilter = ref('')

async function loadBase() {
  const [sessPage, classPage] = await Promise.all([
    academicsApi.listSessions({ perPage: 100 }),
    academicsApi.listClasses({ perPage: 200 }),
  ])
  sessions.value = sessPage.data
  classes.value = classPage.data
  sessionFilter.value =
    sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
}

async function loadStructures() {
  loading.value = true
  loadError.value = null
  try {
    const res = await financeApi.listFeeStructures({
      sessionId: sessionFilter.value || undefined,
      perPage: 200,
    })
    structures.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(sessionFilter, loadStructures)
onMounted(async () => {
  try {
    await loadBase()
    await loadStructures()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
})

function className(id: string | null) {
  if (!id) return 'All classes'
  return classes.value.find((c) => c.id === id)?.name ?? '—'
}

// --- Create / edit structure ----------------------------------------------
const editOpen = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const editingId = ref<string | null>(null)

interface ItemDraft {
  name: string
  amount: string
  isOptional: boolean
  dueDate: string
  description: string
}

const form = reactive({
  name: '',
  classId: '' as string,
  description: '',
  isActive: true,
  items: [] as ItemDraft[],
})

function blankItem(): ItemDraft {
  return { name: '', amount: '', isOptional: false, dueDate: '', description: '' }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '',
    classId: '',
    description: '',
    isActive: true,
    items: [blankItem()],
  })
  formError.value = null
  editOpen.value = true
}

function openEdit(s: FeeStructureDetail) {
  editingId.value = s.id
  Object.assign(form, {
    name: s.name,
    classId: s.classId ?? '',
    description: s.description ?? '',
    isActive: s.isActive,
    items:
      s.items.length > 0
        ? s.items.map((i) => ({
            name: i.name,
            amount: koboToNaira(i.amount),
            isOptional: i.isOptional,
            dueDate: i.dueDate ?? '',
            description: i.description ?? '',
          }))
        : [blankItem()],
  })
  formError.value = null
  editOpen.value = true
}

function addItemRow() {
  form.items.push(blankItem())
}
function removeItemRow(index: number) {
  form.items.splice(index, 1)
}

async function submitForm() {
  const items = form.items
    .filter((i) => i.name.trim())
    .map((i): FeeItemInput => ({
      name: i.name.trim(),
      amount: i.amount ? parseNairaToKobo(i.amount) : 0,
      isOptional: i.isOptional,
      dueDate: i.dueDate || null,
      description: i.description.trim() || null,
    }))
  if (items.length === 0) {
    formError.value = 'Add at least one fee item.'
    return
  }
  saving.value = true
  formError.value = null
  const payload = {
    sessionId: sessionFilter.value,
    classId: form.classId || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    isActive: form.isActive,
    items,
  }
  try {
    if (editingId.value) {
      await financeApi.updateFeeStructure(editingId.value, payload)
    } else {
      await financeApi.createFeeStructure(payload)
    }
    editOpen.value = false
    await loadStructures()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

// --- Single-item management (within an existing structure) ----------------
const itemModalOpen = ref(false)
const itemModalStructureId = ref('')
const itemEditingId = ref<string | null>(null)
const itemSaving = ref(false)
const itemForm = reactive({
  name: '',
  amount: '',
  isOptional: false,
  dueDate: '',
  description: '',
})

function openAddItem(s: FeeStructureDetail) {
  itemModalStructureId.value = s.id
  itemEditingId.value = null
  Object.assign(itemForm, {
    name: '',
    amount: '',
    isOptional: false,
    dueDate: '',
    description: '',
  })
  itemModalOpen.value = true
}

function openEditItem(s: FeeStructureDetail, item: FeeItem) {
  itemModalStructureId.value = s.id
  itemEditingId.value = item.id
  Object.assign(itemForm, {
    name: item.name,
    amount: koboToNaira(item.amount),
    isOptional: item.isOptional,
    dueDate: item.dueDate ?? '',
    description: item.description ?? '',
  })
  itemModalOpen.value = true
}

async function submitItem() {
  itemSaving.value = true
  try {
    const body: FeeItemInput = {
      name: itemForm.name.trim(),
      amount: parseNairaToKobo(itemForm.amount),
      isOptional: itemForm.isOptional,
      dueDate: itemForm.dueDate || null,
      description: itemForm.description.trim() || null,
    }
    if (itemEditingId.value) {
      await financeApi.updateFeeItem(
        itemModalStructureId.value,
        itemEditingId.value,
        body,
      )
    } else {
      await financeApi.addFeeItem(itemModalStructureId.value, body)
    }
    itemModalOpen.value = false
    await loadStructures()
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    itemSaving.value = false
  }
}

async function removeItem(s: FeeStructureDetail, item: FeeItem) {
  if (!confirm(`Remove fee item "${item.name}"?`)) return
  try {
    await financeApi.deleteFeeItem(s.id, item.id)
    await loadStructures()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Fee structures</h1>
        <p class="mt-1 text-sm text-gray-500">
          Templates of fees charged per session and class.
        </p>
      </div>
      <button
        v-if="canManage"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        New structure
      </button>
    </header>

    <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <label class="block text-sm">
        <span class="text-gray-700">Session</span>
        <select
          v-model="sessionFilter"
          class="mt-1 w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option v-for="s in sessions" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </select>
      </label>
    </section>

    <p v-if="loading" class="text-sm text-gray-500">Loading…</p>
    <p
      v-else-if="loadError"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ loadError }}
    </p>

    <div v-else class="space-y-4">
      <p
        v-if="structures.length === 0"
        class="rounded-md bg-gray-50 p-4 text-sm text-gray-600"
      >
        No fee structures in this session.
      </p>

      <article
        v-for="s in structures"
        :key="s.id"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        <header
          class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3"
        >
          <div>
            <h2 class="font-medium text-gray-900">{{ s.name }}</h2>
            <p class="text-xs text-gray-500">
              {{ className(s.classId) }} · {{ s.sessionName }}
              <span
                :class="[
                  'ml-2 rounded-full px-2 py-0.5 text-xs',
                  s.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600',
                ]"
              >
                {{ s.isActive ? 'Active' : 'Inactive' }}
              </span>
            </p>
          </div>
          <button
            v-if="canManage"
            class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            @click="openEdit(s)"
          >
            Edit
          </button>
        </header>
        <table class="min-w-full divide-y divide-gray-100 text-sm">
          <thead class="text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-5 py-2 text-left">Item</th>
              <th class="px-5 py-2 text-right">Amount</th>
              <th class="px-5 py-2 text-center">Optional</th>
              <th class="px-5 py-2 text-left">Due</th>
              <th v-if="canManage" class="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="item in s.items" :key="item.id">
              <td class="px-5 py-2">
                <div class="font-medium text-gray-900">{{ item.name }}</div>
                <div v-if="item.description" class="text-xs text-gray-500">
                  {{ item.description }}
                </div>
              </td>
              <td class="px-5 py-2 text-right text-gray-900">
                {{ formatMoney(item.amount) }}
              </td>
              <td class="px-5 py-2 text-center text-gray-600">
                {{ item.isOptional ? 'Yes' : 'No' }}
              </td>
              <td class="px-5 py-2 text-gray-600">
                {{ item.dueDate ?? '—' }}
              </td>
              <td v-if="canManage" class="px-5 py-2 text-right">
                <button
                  class="mr-3 text-xs text-indigo-600 hover:underline"
                  @click="openEditItem(s, item)"
                >
                  Edit
                </button>
                <button
                  class="text-xs text-red-600 hover:underline"
                  @click="removeItem(s, item)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="canManage"
          class="border-t border-gray-100 px-5 py-2"
        >
          <button
            class="text-xs font-medium text-indigo-600 hover:underline"
            @click="openAddItem(s)"
          >
            + Add fee item
          </button>
        </div>
      </article>
    </div>

    <!-- Structure create/edit modal -->
    <div
      v-if="editOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      @click.self="editOpen = false"
    >
      <div class="my-8 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-medium text-gray-900">
          {{ editingId ? 'Edit fee structure' : 'New fee structure' }}
        </h2>
        <div class="mt-4 space-y-4">
          <label class="block text-sm">
            <span class="text-gray-700">Name</span>
            <input
              v-model="form.name"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. First Term Fees"
            />
          </label>
          <div class="grid grid-cols-2 gap-4">
            <label class="block text-sm">
              <span class="text-gray-700">Class (blank = all classes)</span>
              <select
                v-model="form.classId"
                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All classes</option>
                <option v-for="c in classes" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
            </label>
            <label class="flex items-center gap-2 pt-6 text-sm text-gray-700">
              <input v-model="form.isActive" type="checkbox" />
              Active
            </label>
          </div>
          <label class="block text-sm">
            <span class="text-gray-700">Description</span>
            <textarea
              v-model="form.description"
              rows="2"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </label>

          <fieldset class="rounded-md border border-gray-200 p-3">
            <legend class="px-1 text-xs font-medium uppercase text-gray-500">
              Fee items
            </legend>
            <div class="space-y-3">
              <div
                v-for="(item, idx) in form.items"
                :key="idx"
                class="grid grid-cols-12 gap-2"
              >
                <input
                  v-model="item.name"
                  placeholder="Item name"
                  class="col-span-4 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  v-model="item.amount"
                  inputmode="decimal"
                  placeholder="Amount"
                  class="col-span-2 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  v-model="item.dueDate"
                  type="date"
                  class="col-span-3 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <label
                  class="col-span-2 flex items-center gap-1 text-xs text-gray-600"
                >
                  <input v-model="item.isOptional" type="checkbox" />
                  Optional
                </label>
                <button
                  type="button"
                  class="col-span-1 text-xs text-red-600 hover:underline"
                  @click="removeItemRow(idx)"
                >
                  Remove
                </button>
              </div>
              <button
                type="button"
                class="text-xs font-medium text-indigo-600 hover:underline"
                @click="addItemRow"
              >
                + Add item
              </button>
            </div>
          </fieldset>

          <p
            v-if="formError"
            class="rounded-md bg-red-50 p-2 text-sm text-red-700"
          >
            {{ formError }}
          </p>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            @click="editOpen = false"
          >
            Cancel
          </button>
          <button
            :disabled="saving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="submitForm"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Single fee-item modal -->
    <div
      v-if="itemModalOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      @click.self="itemModalOpen = false"
    >
      <div class="my-8 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-medium text-gray-900">
          {{ itemEditingId ? 'Edit fee item' : 'Add fee item' }}
        </h2>
        <div class="mt-4 space-y-3">
          <label class="block text-sm">
            <span class="text-gray-700">Name</span>
            <input
              v-model="itemForm.name"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Amount</span>
            <input
              v-model="itemForm.amount"
              inputmode="decimal"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Due date</span>
            <input
              v-model="itemForm.dueDate"
              type="date"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="itemForm.isOptional" type="checkbox" />
            Optional fee
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Description</span>
            <textarea
              v-model="itemForm.description"
              rows="2"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </label>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            @click="itemModalOpen = false"
          >
            Cancel
          </button>
          <button
            :disabled="itemSaving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="submitItem"
          >
            {{ itemSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
