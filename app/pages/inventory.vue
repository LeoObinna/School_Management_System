<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { inventoryApi } from '~/services/inventory'
import { formatApiError } from '~/utils/errors'
import type {
  InventoryItemListItem,
  InventoryItemType,
  InventoryCondition,
  InventoryStatus,
} from '~/shared/types'

definePageMeta({ permissions: ['inventory.view'] })

const auth = useAuthStore()
const canManage = computed(() => auth.can('inventory.manage'))

// ---------------------------------------------------------------------------
// List + filters + pagination
// ---------------------------------------------------------------------------

const loading = ref(false)
const loadError = ref<string | null>(null)
const items = ref<InventoryItemListItem[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const lastPage = computed(() =>
  Math.max(1, Math.ceil(total.value / perPage)),
)

const filters = reactive({
  search: '',
  itemType: '' as '' | InventoryItemType,
  status: '' as '' | InventoryStatus,
  condition: '' as '' | InventoryCondition,
})

async function loadItems() {
  loading.value = true
  loadError.value = null
  try {
    const result = await inventoryApi.list({
      page: page.value,
      perPage,
      search: filters.search || undefined,
      itemType: filters.itemType || undefined,
      status: filters.status || undefined,
      condition: filters.condition || undefined,
    })
    items.value = result.data
    total.value = result.meta.total
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadItems()
}

onMounted(() => {
  void loadItems()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<InventoryItemType, string> = {
  book: 'Book',
  equipment: 'Equipment',
}

const CONDITION_LABELS: Record<InventoryCondition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
}

function stockState(item: InventoryItemListItem): {
  label: string
  cls: string
} {
  if (item.status === 'retired') {
    return { label: 'Retired', cls: 'bg-gray-100 text-gray-600' }
  }
  if (item.availableQuantity <= 0) {
    return { label: 'Out of stock', cls: 'bg-red-50 text-red-700' }
  }
  if (item.availableQuantity < Math.ceil(item.quantity * 0.25)) {
    return { label: 'Low stock', cls: 'bg-amber-50 text-amber-700' }
  }
  return { label: 'In stock', cls: 'bg-emerald-50 text-emerald-700' }
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

const formOpen = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  itemType: 'book' as InventoryItemType,
  category: '',
  identifier: '',
  quantity: 1,
  availableQuantity: 1,
  location: '',
  condition: 'good' as InventoryCondition,
  status: 'active' as InventoryStatus,
  notes: '',
})

function resetForm() {
  Object.assign(form, {
    name: '',
    itemType: 'book',
    category: '',
    identifier: '',
    quantity: 1,
    availableQuantity: 1,
    location: '',
    condition: 'good',
    status: 'active',
    notes: '',
  })
  formError.value = null
}

function openCreate() {
  editingId.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(item: InventoryItemListItem) {
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    itemType: item.itemType,
    category: item.category ?? '',
    identifier: item.identifier ?? '',
    quantity: item.quantity,
    availableQuantity: item.availableQuantity,
    location: item.location ?? '',
    condition: item.condition,
    status: item.status,
    notes: item.notes ?? '',
  })
  formError.value = null
  formOpen.value = true
}

async function submitForm() {
  if (!form.name.trim()) {
    formError.value = 'Name is required.'
    return
  }
  if (form.quantity < 1) {
    formError.value = 'Quantity must be at least 1.'
    return
  }
  if (form.availableQuantity < 0 || form.availableQuantity > form.quantity) {
    formError.value = 'Available quantity must be between 0 and total quantity.'
    return
  }
  saving.value = true
  formError.value = null
  try {
    const body = {
      name: form.name,
      itemType: form.itemType,
      category: form.category || null,
      identifier: form.identifier || null,
      quantity: form.quantity,
      availableQuantity: form.availableQuantity,
      location: form.location || null,
      condition: form.condition,
      status: form.status,
      notes: form.notes || null,
    }
    if (editingId.value) {
      await inventoryApi.update(editingId.value, body)
    } else {
      await inventoryApi.create(body)
    }
    formOpen.value = false
    await loadItems()
  } catch (e) {
    formError.value = formatApiError(e)
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

async function removeItem(item: InventoryItemListItem) {
  if (
    !window.confirm(
      `Delete inventory item "${item.name}"? This cannot be undone.`,
    )
  ) {
    return
  }
  try {
    await inventoryApi.remove(item.id)
    await loadItems()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Inventory</h1>
        <p class="mt-1 text-sm text-gray-500">
          Books and equipment stock ledger
        </p>
      </div>
      <button
        v-if="canManage"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        Add item
      </button>
    </header>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-[200px] flex-1">
        <input
          v-model="filters.search"
          type="search"
          placeholder="Search name, identifier or category…"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          @keydown.enter="applyFilters"
        />
      </div>
      <select
        v-model="filters.itemType"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
        @change="applyFilters"
      >
        <option value="">All types</option>
        <option value="book">Books</option>
        <option value="equipment">Equipment</option>
      </select>
      <select
        v-model="filters.condition"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
        @change="applyFilters"
      >
        <option value="">Any condition</option>
        <option value="new">New</option>
        <option value="good">Good</option>
        <option value="fair">Fair</option>
        <option value="poor">Poor</option>
        <option value="damaged">Damaged</option>
      </select>
      <select
        v-model="filters.status"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
        @change="applyFilters"
      >
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="retired">Retired</option>
      </select>
      <button
        class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        @click="applyFilters"
      >
        Search
      </button>
    </div>

    <p v-if="loadError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ loadError }}
    </p>

    <!-- Table -->
    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3">Item</th>
            <th class="px-4 py-3">Type</th>
            <th class="px-4 py-3">Identifier</th>
            <th class="px-4 py-3 text-right">Qty</th>
            <th class="px-4 py-3 text-right">Available</th>
            <th class="px-4 py-3">Location</th>
            <th class="px-4 py-3">Condition</th>
            <th class="px-4 py-3">Status</th>
            <th v-if="canManage" class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td :colspan="canManage ? 9 : 8" class="px-4 py-6 text-center text-gray-500">
              Loading…
            </td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td :colspan="canManage ? 9 : 8" class="px-4 py-6 text-center text-gray-500">
              No inventory items found.
              <button
                v-if="canManage"
                class="font-medium text-indigo-600 hover:underline"
                @click="openCreate"
              >
                Add the first item
              </button>
            </td>
          </tr>
          <tr v-for="item in items" v-else :key="item.id">
            <td class="px-4 py-3">
              <p class="font-medium text-gray-900">{{ item.name }}</p>
              <p v-if="item.category" class="text-xs text-gray-500">{{ item.category }}</p>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ TYPE_LABELS[item.itemType] }}</td>
            <td class="px-4 py-3 text-gray-600">{{ item.identifier ?? '—' }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-gray-700">{{ item.quantity }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-gray-700">
              {{ item.availableQuantity }}
            </td>
            <td class="px-4 py-3 text-gray-600">{{ item.location ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-600">
              {{ CONDITION_LABELS[item.condition] }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                :class="stockState(item).cls"
              >
                {{ stockState(item).label }}
              </span>
            </td>
            <td v-if="canManage" class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  class="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  @click="openEdit(item)"
                >
                  Edit
                </button>
                <button
                  class="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  @click="removeItem(item)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between text-sm text-gray-500">
      <span>{{ total }} item(s) · page {{ page }} of {{ lastPage }}</span>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page--; void loadItems()"
        >
          Previous
        </button>
        <button
          :disabled="page >= lastPage"
          class="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
          @click="page++; void loadItems()"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Create / edit modal -->
    <BaseModal
      :open="formOpen"
      :title="editingId ? 'Edit inventory item' : 'Add inventory item'"
      wide
      @close="formOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitForm">
        <p v-if="formError" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ formError }}
        </p>

        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Name *</span>
          <input
            v-model="form.name"
            maxlength="255"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Type</span>
            <select
              v-model="form.itemType"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="book">Book</option>
              <option value="equipment">Equipment</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Category</span>
            <input
              v-model="form.category"
              maxlength="100"
              placeholder="e.g. Textbook, ICT, Science"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">
              Identifier (ISBN / asset tag)
            </span>
            <input
              v-model="form.identifier"
              maxlength="100"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Location</span>
            <input
              v-model="form.location"
              maxlength="255"
              placeholder="e.g. Library Shelf A2, Science Lab"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Total qty *</span>
            <input
              v-model.number="form.quantity"
              type="number"
              min="1"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Available qty</span>
            <input
              v-model.number="form.availableQuantity"
              type="number"
              min="0"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Condition</span>
            <select
              v-model="form.condition"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="damaged">Damaged</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="block font-medium text-gray-700">Status</span>
            <select
              v-model="form.status"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </label>
        </div>

        <label class="block text-sm">
          <span class="block font-medium text-gray-700">Notes</span>
          <textarea
            v-model="form.notes"
            rows="2"
            maxlength="2000"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="formOpen = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
