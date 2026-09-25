<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { academicsApi } from '~/services/academics'
import { peopleApi } from '~/services/people'
import { financeApi } from '~/services/finance'
import { formatApiError } from '~/utils/errors'
import {
  formatMoney,
  koboToNaira,
  parseNairaToKobo,
} from '~/shared/utils/money'
import { INVOICE_STATUSES, PAYMENT_METHODS } from '~/shared/schemas'
import type {
  AcademicSession,
  FeeStructureDetail,
  FinanceSummary,
  InvoiceDetail,
  InvoiceListItem,
  SchoolClass,
  Student,
  Term,
} from '~/shared/types'
import type { InvoiceCreate } from '~/shared/schemas'

definePageMeta({ permissions: ['invoices.view'] })

const auth = useAuthStore()
const canCreate = computed(() => auth.can('invoices.create'))
const canUpdate = computed(() => auth.can('invoices.update'))
const canRecord = computed(() => auth.can('payments.record'))
const canVerify = computed(() => auth.can('payments.verify'))
const canRefund = computed(() => auth.can('payments.refund'))

// --- Filters + lists -------------------------------------------------------
const loading = ref(false)
const loadError = ref<string | null>(null)
const invoices = ref<InvoiceListItem[]>([])
const sessions = ref<AcademicSession[]>([])
const terms = ref<Term[]>([])
const classes = ref<SchoolClass[]>([])
const summary = ref<FinanceSummary | null>(null)
const filters = reactive({
  sessionId: '',
  termId: '',
  status: '',
  studentId: '',
})

async function loadTerms(sessionId: string) {
  if (!sessionId) {
    terms.value = []
    return
  }
  const page = await academicsApi.listTerms({ sessionId, perPage: 50 })
  terms.value = page.data
}

async function loadInvoices() {
  loading.value = true
  loadError.value = null
  try {
    const [res, sum] = await Promise.all([
      financeApi.listInvoices({
        sessionId: filters.sessionId || undefined,
        termId: filters.termId || undefined,
        status: (filters.status || undefined) as never,
        studentId: filters.studentId || undefined,
      }),
      auth.can('invoices.create')
        ? financeApi
            .summary({
              sessionId: filters.sessionId || undefined,
              termId: filters.termId || undefined,
            })
            .catch(() => null)
        : Promise.resolve(null),
    ])
    invoices.value = res.data
    summary.value = sum
  } catch (e) {
    loadError.value = formatApiError(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => filters.sessionId,
  async (id) => {
    await loadTerms(id)
    await loadInvoices()
  },
)
watch([() => filters.termId, () => filters.status, () => filters.studentId], loadInvoices)

onMounted(async () => {
  try {
    const [sessPage, classPage] = await Promise.all([
      academicsApi.listSessions({ perPage: 100 }),
      academicsApi.listClasses({ perPage: 100 }),
    ])
    sessions.value = sessPage.data
    classes.value = classPage.data
    filters.sessionId =
      sessions.value.find((s) => s.isCurrent)?.id ?? sessions.value[0]?.id ?? ''
    await loadTerms(filters.sessionId)
    await loadInvoices()
  } catch (e) {
    loadError.value = formatApiError(e)
  }
})

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void: 'bg-gray-200 text-gray-600',
}

function statusLabel(s: string, overdue: boolean) {
  if (s === 'issued' || s === 'partially_paid') {
    return overdue ? 'overdue' : s
  }
  return s
}

// --- Student picker --------------------------------------------------------
const studentResults = ref<Student[]>([])
const studentQuery = ref('')
const selectedStudent = ref<Student | null>(null)
let studentTimer: ReturnType<typeof setTimeout> | null = null

watch(studentQuery, (q) => {
  if (studentTimer) clearTimeout(studentTimer)
  if (!q.trim() || selectedStudent.value) {
    studentResults.value = []
    return
  }
  studentTimer = setTimeout(async () => {
    try {
      const page = await peopleApi.listStudents({
        search: q.trim(),
        perPage: 10,
      })
      studentResults.value = page.data
    } catch {
      studentResults.value = []
    }
  }, 250)
})

function chooseStudent(s: Student) {
  selectedStudent.value = s
  filters.studentId = s.id
  studentQuery.value = `${s.firstName} ${s.lastName} (${s.admissionNumber})`
  studentResults.value = []
}

function clearStudentFilter() {
  selectedStudent.value = null
  filters.studentId = ''
  studentQuery.value = ''
}

// --- Create invoice --------------------------------------------------------
const createOpen = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const structures = ref<FeeStructureDetail[]>([])
const createForm = reactive({
  termId: '',
  dueDate: '',
  issueDate: new Date().toISOString().slice(0, 10),
  notes: '',
  feeStructureId: '',
  selectedFeeItemIds: [] as string[],
  manualItems: [] as { description: string; quantity: number; unitAmount: string }[],
})

async function openCreate() {
  if (!selectedStudent.value) {
    createError.value = 'Search and select a student first.'
    return
  }
  createError.value = null
  createForm.termId = filters.termId ?? ''
  createForm.dueDate = ''
  createForm.notes = ''
  createForm.feeStructureId = ''
  createForm.selectedFeeItemIds = []
  createForm.manualItems = [{ description: '', quantity: 1, unitAmount: '' }]
  createOpen.value = true
  try {
    const res = await financeApi.listFeeStructures({
      sessionId: filters.sessionId,
      perPage: 100,
    })
    structures.value = res.data
  } catch (e) {
    createError.value = formatApiError(e)
  }
}

const selectedStructure = computed(() =>
  structures.value.find((s) => s.id === createForm.feeStructureId) ?? null,
)

// The backend treats a non-empty feeItemIds list as a complete override
// (required items are auto-added only when the list is empty), so the
// structure starts with every required item checked.
function selectStructure(id: string) {
  createForm.feeStructureId = id
  const structure = structures.value.find((s) => s.id === id)
  createForm.selectedFeeItemIds = structure
    ? structure.items.filter((i) => !i.isOptional).map((i) => i.id)
    : []
}

function onStructureChange(event: Event) {
  selectStructure((event.target as HTMLSelectElement).value)
}

function toggleFeeItem(id: string) {
  const idx = createForm.selectedFeeItemIds.indexOf(id)
  if (idx >= 0) createForm.selectedFeeItemIds.splice(idx, 1)
  else createForm.selectedFeeItemIds.push(id)
}

function addManualRow() {
  createForm.manualItems.push({ description: '', quantity: 1, unitAmount: '' })
}
function removeManualRow(i: number) {
  createForm.manualItems.splice(i, 1)
}

async function submitInvoice() {
  if (!selectedStudent.value) return
  creating.value = true
  createError.value = null
  try {
    let payload: InvoiceCreate
    if (createForm.feeStructureId) {
      if (createForm.selectedFeeItemIds.length === 0) {
        createError.value = 'Select at least one fee item.'
        creating.value = false
        return
      }
      payload = {
        studentId: selectedStudent.value.id,
        sessionId: filters.sessionId,
        termId: createForm.termId || null,
        issueDate: createForm.issueDate,
        dueDate: createForm.dueDate || null,
        notes: createForm.notes.trim() || null,
        feeStructureId: createForm.feeStructureId,
        feeItemIds: [...createForm.selectedFeeItemIds],
      }
    } else {
      const items = createForm.manualItems
        .filter((i) => i.description.trim() && i.unitAmount)
        .map((i) => ({
          description: i.description.trim(),
          quantity: Number.isFinite(i.quantity) ? i.quantity : 1,
          unitAmount: parseNairaToKobo(i.unitAmount),
        }))
      if (items.length === 0) {
        createError.value = 'Add at least one line item or choose a fee structure.'
        creating.value = false
        return
      }
      payload = {
        studentId: selectedStudent.value.id,
        sessionId: filters.sessionId,
        termId: createForm.termId || null,
        issueDate: createForm.issueDate,
        dueDate: createForm.dueDate || null,
        notes: createForm.notes.trim() || null,
        items,
      }
    }
    const invoice = await financeApi.createInvoice(payload)
    createOpen.value = false
    detailInvoice.value = invoice
    detailOpen.value = true
    await loadInvoices()
  } catch (e) {
    createError.value = formatApiError(e)
  } finally {
    creating.value = false
  }
}

// --- Invoice detail + payments ---------------------------------------------
const detailOpen = ref(false)
const detailInvoice = ref<InvoiceDetail | null>(null)
const detailError = ref<string | null>(null)
const busy = ref(false)
const invoiceQrFailed = ref(false)

async function openDetail(inv: InvoiceListItem) {
  detailError.value = null
  invoiceQrFailed.value = false
  try {
    detailInvoice.value = await financeApi.getInvoice(inv.id)
    detailOpen.value = true
  } catch (e) {
    detailError.value = formatApiError(e)
  }
}

async function refreshDetail() {
  if (!detailInvoice.value) return
  detailInvoice.value = await financeApi.getInvoice(detailInvoice.value.id)
}

async function issueInvoice(inv: InvoiceDetail) {
  if (!confirm(`Issue invoice ${inv.invoiceNumber}?`)) return
  busy.value = true
  try {
    detailInvoice.value = await financeApi.issueInvoice(inv.id)
    await loadInvoices()
  } catch (e) {
    detailError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}

async function voidInvoice(inv: InvoiceDetail) {
  if (!confirm(`Void invoice ${inv.invoiceNumber}? This cannot be undone.`)) return
  busy.value = true
  try {
    detailInvoice.value = await financeApi.voidInvoice(inv.id)
    await loadInvoices()
  } catch (e) {
    detailError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}

const paymentForm = reactive({
  amount: '',
  method: 'cash' as (typeof PAYMENT_METHODS)[number],
  notes: '',
  verifyImmediately: true,
})

function openPayment(inv: InvoiceDetail) {
  paymentForm.amount = koboToNaira(inv.balance)
  paymentForm.method = 'cash'
  paymentForm.notes = ''
  paymentForm.verifyImmediately = canVerify.value
  paymentModalOpen.value = true
}

const paymentModalOpen = ref(false)

async function submitPayment() {
  if (!detailInvoice.value) return
  busy.value = true
  detailError.value = null
  try {
    await financeApi.recordPayment({
      invoiceId: detailInvoice.value.id,
      amount: parseNairaToKobo(paymentForm.amount),
      method: paymentForm.method,
      notes: paymentForm.notes.trim() || null,
      verifyImmediately: paymentForm.verifyImmediately,
    })
    paymentModalOpen.value = false
    await refreshDetail()
    await loadInvoices()
  } catch (e) {
    detailError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}

async function verifyPayment(paymentId: string) {
  if (!confirm('Mark this payment as verified? A receipt will be generated.')) return
  busy.value = true
  try {
    await financeApi.verifyPayment(paymentId)
    await refreshDetail()
    await loadInvoices()
  } catch (e) {
    detailError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}

async function refundPayment(paymentId: string) {
  if (!confirm('Refund this verified payment? The invoice balance will increase.')) return
  busy.value = true
  try {
    await financeApi.refundPayment(paymentId, { notes: 'Refunded by finance officer.' })
    await refreshDetail()
    await loadInvoices()
  } catch (e) {
    detailError.value = formatApiError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold text-gray-900">Invoices &amp; payments</h1>
      <p class="mt-1 text-sm text-gray-500">
        Issue invoices, record and verify payments, issue refunds and receipts.
      </p>
    </header>

    <!-- Summary cards -->
    <section
      v-if="summary"
      class="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500">Invoiced</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">
          {{ formatMoney(summary.totalInvoiced) }}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500">Collected</p>
        <p class="mt-1 text-lg font-semibold text-green-700">
          {{ formatMoney(summary.totalCollected) }}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500">Outstanding</p>
        <p class="mt-1 text-lg font-semibold text-amber-700">
          {{ formatMoney(summary.totalOutstanding) }}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500">Refunded</p>
        <p class="mt-1 text-lg font-semibold text-red-700">
          {{ formatMoney(summary.totalRefunded) }}
        </p>
      </div>
    </section>

    <!-- Filters -->
    <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block text-sm">
          <span class="text-gray-700">Session</span>
          <select
            v-model="filters.sessionId"
            class="mt-1 w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option v-for="s in sessions" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Term</span>
          <select
            v-model="filters.termId"
            class="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All terms</option>
            <option v-for="t in terms" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700">Status</span>
          <select
            v-model="filters.status"
            class="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option v-for="s in INVOICE_STATUSES" :key="s" :value="s">
              {{ s.replace('_', ' ') }}
            </option>
          </select>
        </label>
        <div class="relative w-64">
          <span class="text-sm text-gray-700">Student</span>
          <input
            v-model="studentQuery"
            placeholder="Search name or admission no"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            v-if="filters.studentId"
            class="absolute right-2 top-8 text-xs text-gray-500 hover:text-gray-800"
            @click="clearStudentFilter"
          >
            clear
          </button>
          <div
            v-if="studentResults.length"
            class="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
          >
            <button
              v-for="s in studentResults"
              :key="s.id"
              class="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
              @click="chooseStudent(s)"
            >
              {{ s.firstName }} {{ s.lastName }} ({{ s.admissionNumber }})
            </button>
          </div>
        </div>
        <button
          v-if="canCreate"
          :disabled="!filters.studentId"
          class="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          @click="openCreate"
        >
          New invoice
        </button>
      </div>
      <p
        v-if="canCreate && !filters.studentId"
        class="mt-2 text-xs text-gray-500"
      >
        Search and select a student to create an invoice.
      </p>
    </section>

    <p v-if="loading" class="text-sm text-gray-500">Loading…</p>
    <p
      v-else-if="loadError"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ loadError }}
    </p>

    <!-- Invoice table -->
    <section
      class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
    >
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-4 py-3 text-left">Invoice</th>
            <th class="px-4 py-3 text-left">Student</th>
            <th class="px-4 py-3 text-left">Term</th>
            <th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-right">Paid</th>
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
            <td class="px-4 py-3 text-gray-900">{{ inv.studentName }}</td>
            <td class="px-4 py-3 text-gray-600">{{ inv.termName ?? '—' }}</td>
            <td class="px-4 py-3 text-right text-gray-900">
              {{ formatMoney(inv.total) }}
            </td>
            <td class="px-4 py-3 text-right text-gray-700">
              {{ formatMoney(inv.amountPaid) }}
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
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500">
              No invoices found.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Detail drawer/modal -->
    <div
      v-if="detailOpen && detailInvoice"
      class="fixed inset-0 z-40 flex justify-end bg-black/40"
      @click.self="detailOpen = false"
    >
      <div class="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ detailInvoice.invoiceNumber }}
            </h2>
            <p class="text-sm text-gray-500">
              {{ detailInvoice.studentName }} ·
              {{ detailInvoice.admissionNumber }} ·
              {{ detailInvoice.termName ?? 'No term' }}
            </p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-700"
            @click="detailOpen = false"
          >
            ✕
          </button>
        </div>

        <p
          v-if="detailError"
          class="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700"
        >
          {{ detailError }}
        </p>

        <!-- Items -->
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
            <tr v-for="item in detailInvoice.items" :key="item.id">
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
            <dd>{{ formatMoney(detailInvoice.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Discount</dt>
            <dd>-{{ formatMoney(detailInvoice.discount) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Tax</dt>
            <dd>{{ formatMoney(detailInvoice.tax) }}</dd>
          </div>
          <div class="flex justify-between border-t pt-1 font-medium">
            <dt>Total</dt>
            <dd>{{ formatMoney(detailInvoice.total) }}</dd>
          </div>
          <div class="flex justify-between text-green-700">
            <dt>Paid</dt>
            <dd>{{ formatMoney(detailInvoice.amountPaid) }}</dd>
          </div>
          <div class="flex justify-between font-semibold">
            <dt>Balance</dt>
            <dd>{{ formatMoney(detailInvoice.balance) }}</dd>
          </div>
        </dl>

        <!-- Actions -->
        <div class="mt-5 flex flex-wrap gap-2">
          <button
            v-if="canUpdate && detailInvoice.status === 'draft'"
            :disabled="busy"
            class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            @click="issueInvoice(detailInvoice)"
          >
            Issue
          </button>
          <button
            v-if="
              canRecord &&
              ['issued', 'partially_paid'].includes(detailInvoice.status) &&
              detailInvoice.balance > 0
            "
            :disabled="busy"
            class="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            @click="openPayment(detailInvoice)"
          >
            Record payment
          </button>
          <button
            v-if="
              canUpdate &&
              ['draft', 'issued'].includes(detailInvoice.status) &&
              detailInvoice.amountPaid === 0
            "
            :disabled="busy"
            class="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            @click="voidInvoice(detailInvoice)"
          >
            Void
          </button>
        </div>

        <!-- Per-invoice bank-transfer QR (Phase 15); 404s without bank details -->
        <div
          v-if="
            !invoiceQrFailed &&
            detailInvoice.balance > 0 &&
            ['issued', 'partially_paid'].includes(detailInvoice.status)
          "
          class="mt-4"
        >
          <img
            :src="financeApi.invoiceQrUrl(detailInvoice.id)"
            alt="Invoice bank-transfer QR code"
            class="h-28 w-28 rounded border border-gray-200"
            loading="lazy"
            title="Bank-transfer details + amount due"
            @error="invoiceQrFailed = true"
          >
        </div>

        <!-- Payments -->
        <h3 class="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Payments
        </h3>
        <div
          v-if="detailInvoice.payments.length === 0"
          class="mt-2 text-sm text-gray-500"
        >
          No payments recorded.
        </div>
        <ul class="mt-2 space-y-2">
          <li
            v-for="p in detailInvoice.payments"
            :key="p.id"
            class="flex flex-wrap items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
          >
            <div>
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
                {{ p.paymentReference }} · {{ p.method.replace('_', ' ') }}
              </p>
              <p v-if="p.receiptNumber" class="text-xs text-indigo-700">
                Receipt {{ p.receiptNumber }}
              </p>
            </div>
            <div class="flex gap-2">
              <a
                v-if="p.receiptNumber"
                :href="`/api/v1/payments/${p.id}/receipt/download`"
                class="text-xs font-medium text-indigo-600 hover:underline"
              >
                Receipt PDF
              </a>
              <button
                v-if="canVerify && p.status === 'pending'"
                :disabled="busy"
                class="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                @click="verifyPayment(p.id)"
              >
                Verify
              </button>
              <button
                v-if="canRefund && p.status === 'verified'"
                :disabled="busy"
                class="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                @click="refundPayment(p.id)"
              >
                Refund
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Create invoice modal -->
    <div
      v-if="createOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      @click.self="createOpen = false"
    >
      <div class="my-12 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-medium text-gray-900">New invoice</h2>
            <p v-if="selectedStudent" class="text-sm text-gray-500">
              {{ selectedStudent.firstName }} {{ selectedStudent.lastName }}
              ({{ selectedStudent.admissionNumber }})
            </p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-700"
            @click="createOpen = false"
          >
            ✕
          </button>
        </div>

        <p
          v-if="createError"
          class="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700"
        >
          {{ createError }}
        </p>

        <div class="mt-4 space-y-4 text-sm">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="block">
              <span class="text-gray-700">Term</span>
              <select
                v-model="createForm.termId"
                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">No term</option>
                <option v-for="t in terms" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="text-gray-700">Issue date</span>
              <input
                v-model="createForm.issueDate"
                type="date"
                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label class="block">
              <span class="text-gray-700">Due date</span>
              <input
                v-model="createForm.dueDate"
                type="date"
                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-gray-700">Notes</span>
            <textarea
              v-model="createForm.notes"
              rows="2"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            ></textarea>
          </label>

          <label class="block">
            <span class="text-gray-700">Bill from fee structure</span>
            <select
              :value="createForm.feeStructureId"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              @change="onStructureChange"
            >
              <option value="">— Custom line items —</option>
              <option v-for="s in structures" :key="s.id" :value="s.id">
                {{ s.name }} · {{ s.className ?? 'All classes' }}
              </option>
            </select>
          </label>

          <!-- Fee structure items -->
          <div
            v-if="selectedStructure"
            class="rounded-md border border-gray-200 p-3"
          >
            <p class="text-xs text-gray-500">
              Required items are included automatically; tick optional items
              to add them.
            </p>
            <ul class="mt-2 space-y-1">
              <li
                v-for="item in selectedStructure.items"
                :key="item.id"
                class="flex items-center justify-between gap-2"
              >
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="rounded border-gray-300"
                    :checked="
                      !item.isOptional ||
                      createForm.selectedFeeItemIds.includes(item.id)
                    "
                    :disabled="!item.isOptional"
                    @change="toggleFeeItem(item.id)"
                  />
                  <span class="text-gray-900">{{ item.name }}</span>
                  <span
                    :class="[
                      'rounded-full px-2 py-0.5 text-xs',
                      item.isOptional
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-500',
                    ]"
                  >
                    {{ item.isOptional ? 'optional' : 'required' }}
                  </span>
                </label>
                <span class="text-gray-700">
                  {{ formatMoney(item.amount) }}
                </span>
              </li>
            </ul>
          </div>

          <!-- Manual line items -->
          <div v-else class="space-y-2">
            <p class="text-xs text-gray-500">
              Add one or more custom line items (amounts in naira).
            </p>
            <div
              v-for="(row, i) in createForm.manualItems"
              :key="i"
              class="flex items-center gap-2"
            >
              <input
                v-model="row.description"
                placeholder="Description"
                class="flex-1 rounded-md border border-gray-300 px-3 py-2"
              />
              <input
                v-model.number="row.quantity"
                type="number"
                min="1"
                step="1"
                aria-label="Quantity"
                class="w-16 rounded-md border border-gray-300 px-2 py-2"
              />
              <input
                v-model="row.unitAmount"
                inputmode="decimal"
                placeholder="₦ amount"
                aria-label="Unit amount in naira"
                class="w-32 rounded-md border border-gray-300 px-2 py-2"
              />
              <button
                type="button"
                class="rounded-md border border-gray-300 px-2 py-2 text-gray-500 hover:bg-gray-50"
                @click="removeManualRow(i)"
              >
                ✕
              </button>
            </div>
            <button
              type="button"
              class="text-sm font-medium text-indigo-600 hover:underline"
              @click="addManualRow"
            >
              + Add line item
            </button>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            @click="createOpen = false"
          >
            Cancel
          </button>
          <button
            :disabled="creating"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="submitInvoice"
          >
            {{ creating ? 'Creating…' : 'Create invoice' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Record payment modal -->
    <div
      v-if="paymentModalOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      @click.self="paymentModalOpen = false"
    >
      <div class="my-12 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-medium text-gray-900">Record payment</h2>
        <div class="mt-4 space-y-3">
          <label class="block text-sm">
            <span class="text-gray-700">Amount</span>
            <input
              v-model="paymentForm.amount"
              inputmode="decimal"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Method</span>
            <select
              v-model="paymentForm.method"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">
                {{ m.replace('_', ' ') }}
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700">Notes</span>
            <textarea
              v-model="paymentForm.notes"
              rows="2"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </label>
          <label
            v-if="canVerify"
            class="flex items-center gap-2 text-sm text-gray-700"
          >
            <input v-model="paymentForm.verifyImmediately" type="checkbox" />
            Verify immediately (issue receipt)
          </label>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            @click="paymentModalOpen = false"
          >
            Cancel
          </button>
          <button
            :disabled="busy"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="submitPayment"
          >
            {{ busy ? 'Saving…' : 'Record' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
