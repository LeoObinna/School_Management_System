<script setup lang="ts">
import { examsApi } from '~/services/exams'
import { financeApi } from '~/services/finance'
import { formatApiError } from '~/utils/errors'
import { formatMoney } from '~/shared/utils/money'
import type {
  InvoiceDetail,
  InvoiceListItem,
  MySchoolContext,
} from '~/shared/types'

definePageMeta({ permissions: ['invoices.view'] })

// --- School context (studentId / children) ---------------------------------
const ctx = ref<MySchoolContext | null>(null)
const ctxLoading = ref(true)
const ctxError = ref<string | null>(null)
const selectedStudentId = ref('')

async function loadContext() {
  ctxLoading.value = true
  ctxError.value = null
  try {
    ctx.value = await examsApi.getMySchoolContext()
    if (ctx.value.studentId) selectedStudentId.value = ctx.value.studentId
    else if (ctx.value.children[0])
      selectedStudentId.value = ctx.value.children[0].id
  } catch (e) {
    ctxError.value = formatApiError(e)
  } finally {
    ctxLoading.value = false
  }
}

const isParent = computed(() => Boolean(ctx.value && ctx.value.children.length > 0))
const isStudent = computed(() => Boolean(ctx.value && ctx.value.studentId))

// --- Invoices --------------------------------------------------------------
const loading = ref(false)
const loadError = ref<string | null>(null)
const invoices = ref<InvoiceListItem[]>([])

async function loadInvoices() {
  if (!selectedStudentId.value) {
    invoices.value = []
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const res = await financeApi.listInvoices({
      studentId: selectedStudentId.value,
    })
    invoices.value = res.data
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(selectedStudentId, loadInvoices)

onMounted(async () => {
  await loadContext()
  if (!ctxError.value) await loadInvoices()
})

// Totals (kobo integers, summed exactly)
const totalBalance = computed(() =>
  invoices.value
    .filter((i) => i.status !== 'void')
    .reduce((acc, i) => acc + i.balance, 0),
)
const totalPaid = computed(() =>
  invoices.value.reduce((acc, i) => acc + i.amountPaid, 0),
)

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void: 'bg-gray-200 text-gray-600',
}
function statusLabel(s: string, overdue: boolean) {
  if ((s === 'issued' || s === 'partially_paid') && overdue) return 'overdue'
  return s
}

// --- Invoice detail (read-only) --------------------------------------------
const detailOpen = ref(false)
const detail = ref<InvoiceDetail | null>(null)
const detailError = ref<string | null>(null)

async function openDetail(inv: InvoiceListItem) {
  detailError.value = null
  try {
    detail.value = await financeApi.getInvoice(inv.id)
    detailOpen.value = true
  } catch (e) {
    detailError.value = formatApiError(e)
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold text-gray-900">My billing</h1>
      <p class="mt-1 text-sm text-gray-500">
        Invoices, payment history and receipts.
      </p>
    </header>

    <p v-if="ctxLoading" class="text-sm text-gray-500">Loading…</p>
    <p
      v-else-if="ctxError"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ ctxError }}
    </p>
    <div
      v-else-if="!isParent && !isStudent"
      class="rounded-md bg-amber-50 p-4 text-sm text-amber-800"
    >
      Your account is not linked to a student profile. Please contact the school
      office if you expected to see billing here.
    </div>

    <template v-else>
      <section class="flex flex-wrap items-end gap-3">
        <label v-if="isParent" class="block text-sm">
          <span class="text-gray-700">Child</span>
          <select
            v-model="selectedStudentId"
            class="mt-1 w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option
              v-for="child in ctx?.children ?? []"
              :key="child.id"
              :value="child.id"
            >
              {{ child.name }} ({{ child.admissionNumber ?? '—' }})
            </option>
          </select>
        </label>
        <div class="ml-auto grid grid-cols-2 gap-3">
          <div class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right shadow-sm">
            <p class="text-xs uppercase tracking-wide text-gray-500">Paid</p>
            <p class="font-semibold text-green-700">{{ formatMoney(totalPaid) }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right shadow-sm">
            <p class="text-xs uppercase tracking-wide text-gray-500">Balance</p>
            <p class="font-semibold text-amber-700">{{ formatMoney(totalBalance) }}</p>
          </div>
        </div>
      </section>

      <p v-if="loading" class="text-sm text-gray-500">Loading invoices…</p>
      <p
        v-else-if="loadError"
        class="rounded-md bg-red-50 p-3 text-sm text-red-700"
      >
        {{ loadError }}
      </p>

      <section
        v-else
        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead
            class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"
          >
            <tr>
              <th class="px-4 py-3 text-left">Invoice</th>
              <th class="px-4 py-3 text-left">Term</th>
              <th class="px-4 py-3 text-left">Due</th>
              <th class="px-4 py-3 text-right">Total</th>
              <th class="px-4 py-3 text-right">Balance</th>
              <th class="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="inv in invoices"
              :key="inv.id"
              class="cursor-pointer hover:bg-indigo-50/40"
              @click="openDetail(inv)"
            >
              <td class="px-4 py-3 font-medium text-indigo-700">
                {{ inv.invoiceNumber }}
              </td>
              <td class="px-4 py-3 text-gray-600">{{ inv.termName ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ inv.dueDate ?? '—' }}</td>
              <td class="px-4 py-3 text-right text-gray-900">
                {{ formatMoney(inv.total) }}
              </td>
              <td class="px-4 py-3 text-right font-medium text-gray-900">
                {{ formatMoney(inv.balance) }}
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  :class="[
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    STATUS_STYLES[statusLabel(inv.status, inv.overdue)] ??
                      'bg-gray-100 text-gray-700',
                  ]"
                >
                  {{ statusLabel(inv.status, inv.overdue).replace('_', ' ') }}
                </span>
              </td>
            </tr>
            <tr v-if="invoices.length === 0">
              <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">
                No invoices on record.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Invoice detail -->
    <div
      v-if="detailOpen && detail"
      class="fixed inset-0 z-40 flex justify-end bg-black/40"
      @click.self="detailOpen = false"
    >
      <div class="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ detail.invoiceNumber }}
            </h2>
            <p class="text-sm text-gray-500">
              {{ detail.termName ?? 'No term' }} ·
              issued {{ detail.issueDate ?? '—' }}
            </p>
          </div>
          <button class="text-gray-400 hover:text-gray-700" @click="detailOpen = false">
            ✕
          </button>
        </div>

        <p
          v-if="detailError"
          class="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700"
        >
          {{ detailError }}
        </p>

        <table class="mt-4 min-w-full divide-y divide-gray-200 text-sm">
          <thead class="text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="py-2 text-left">Description</th>
              <th class="py-2 text-right">Qty</th>
              <th class="py-2 text-right">Unit</th>
              <th class="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in detail.items" :key="item.id">
              <td class="py-2 text-gray-900">{{ item.description }}</td>
              <td class="py-2 text-right text-gray-700">{{ item.quantity }}</td>
              <td class="py-2 text-right text-gray-700">
                {{ formatMoney(item.unitAmount) }}
              </td>
              <td class="py-2 text-right text-gray-900">
                {{ formatMoney(item.lineTotal) }}
              </td>
            </tr>
          </tbody>
        </table>

        <dl class="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div class="flex justify-between">
            <dt class="text-gray-500">Subtotal</dt>
            <dd>{{ formatMoney(detail.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Discount</dt>
            <dd>-{{ formatMoney(detail.discount) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Tax</dt>
            <dd>{{ formatMoney(detail.tax) }}</dd>
          </div>
          <div class="flex justify-between border-t pt-1 font-medium">
            <dt>Total</dt>
            <dd>{{ formatMoney(detail.total) }}</dd>
          </div>
          <div class="flex justify-between text-green-700">
            <dt>Paid</dt>
            <dd>{{ formatMoney(detail.amountPaid) }}</dd>
          </div>
          <div class="flex justify-between font-semibold">
            <dt>Balance</dt>
            <dd>{{ formatMoney(detail.balance) }}</dd>
          </div>
        </dl>

        <h3
          class="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          Payments
        </h3>
        <div
          v-if="detail.payments.length === 0"
          class="mt-2 text-sm text-gray-500"
        >
          No payments recorded yet.
        </div>
        <ul class="mt-2 space-y-2">
          <li
            v-for="p in detail.payments"
            :key="p.id"
            class="rounded-md border border-gray-200 px-3 py-2 text-sm"
          >
            <div class="flex items-center justify-between">
              <p class="font-medium text-gray-900">
                {{ formatMoney(p.amount) }}
                <span
                  :class="[
                    'ml-2 rounded-full px-2 py-0.5 text-xs',
                    p.status === 'verified'
                      ? 'bg-green-100 text-green-700'
                      : p.status === 'refunded'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800',
                  ]"
                >
                  {{ p.status }}
                </span>
              </p>
              <p class="text-xs text-gray-500">
                {{ p.method.replace('_', ' ') }}
              </p>
            </div>
            <p
              v-if="p.receiptNumber"
              class="mt-1 text-xs text-indigo-700"
            >
              Receipt {{ p.receiptNumber }}
            </p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
