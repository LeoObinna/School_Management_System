/**
 * Finance API access layer (README §19, Phase 8).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type {
  FeeStructureDetail,
  FinanceSummary,
  InvoiceDetail,
  InvoiceListItem,
  OfficeBankDetails,
  OutstandingRow,
  Paginated,
  PaymentDetail,
  PaymentListItem,
  PaymentReceipt,
  PaystackConfigStatus,
  PaystackInitializeResult,
  PaystackVerifyResult,
} from '~/shared/types'
import type {
  FeeStructureCreate,
  FeeStructureListQuery,
  FeeStructureUpdate,
  FeeItemUpsert,
  FinanceSummaryQuery,
  InvoiceCreate,
  InvoiceListQuery,
  InvoiceUpdate,
  OutstandingQuery,
  PaymentCreate,
  PaymentListQuery,
  PaymentRefund,
  PaymentVerify,
  PaystackInitialize,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

export const financeApi = {
  // --- Fee structures ----------------------------------------------------
  listFeeStructures: (params?: Partial<FeeStructureListQuery>) =>
    api.get<{ data: FeeStructureDetail[] }>('/fee-structures', { params }),
  createFeeStructure: (body: FeeStructureCreate) =>
    api.post<FeeStructureDetail>('/fee-structures', body),
  getFeeStructure: (id: string) =>
    api.get<FeeStructureDetail>(`/fee-structures/${id}`),
  updateFeeStructure: (id: string, body: FeeStructureUpdate) =>
    api.put<FeeStructureDetail>(`/fee-structures/${id}`, body),
  addFeeItem: (id: string, body: FeeItemUpsert) =>
    api.post<FeeStructureDetail>(`/fee-structures/${id}/items`, body),
  updateFeeItem: (
    id: string,
    itemId: string,
    body: FeeItemUpsert,
  ) =>
    api.put<FeeStructureDetail>(
      `/fee-structures/${id}/items/${itemId}`,
      body,
    ),
  deleteFeeItem: (id: string, itemId: string) =>
    api.del<{ message: string }>(
      `/fee-structures/${id}/items/${itemId}`,
    ),

  // --- Invoices ----------------------------------------------------------
  listInvoices: (params?: Partial<InvoiceListQuery>) =>
    api.get<{ data: InvoiceListItem[] }>('/invoices', { params }),
  getInvoice: (id: string) =>
    api.get<InvoiceDetail>(`/invoices/${id}`),
  createInvoice: (body: InvoiceCreate) =>
    api.post<InvoiceDetail>('/invoices', body),
  updateInvoice: (id: string, body: InvoiceUpdate) =>
    api.put<InvoiceDetail>(`/invoices/${id}`, body),
  issueInvoice: (id: string) =>
    api.post<InvoiceDetail>(`/invoices/${id}/issue`),
  voidInvoice: (id: string) =>
    api.post<InvoiceDetail>(`/invoices/${id}/void`),

  // --- Payments ----------------------------------------------------------
  listPayments: (params?: Partial<PaymentListQuery>) =>
    api.get<{ data: PaymentListItem[] }>('/payments', { params }),
  getPayment: (id: string) =>
    api.get<PaymentDetail>(`/payments/${id}`),
  recordPayment: (body: PaymentCreate) =>
    api.post<PaymentDetail>('/payments', body),
  verifyPayment: (id: string, body: PaymentVerify = {}) =>
    api.post<PaymentDetail>(`/payments/${id}/verify`, body),
  refundPayment: (id: string, body: PaymentRefund = {}) =>
    api.post<PaymentDetail>(`/payments/${id}/refund`, body),
  getReceipt: (id: string) =>
    api.get<PaymentReceipt>(`/payments/${id}/receipt`),

  // --- Paystack online checkout (Phase 15) --------------------------------
  getPaystackConfig: () =>
    api.get<PaystackConfigStatus>('/payments/paystack/config'),
  initializePaystack: (body: PaystackInitialize) =>
    api.post<PaystackInitializeResult>('/payments/paystack/initialize', body),
  verifyPaystack: (reference: string) =>
    api.post<PaystackVerifyResult>('/payments/paystack/verify', { reference }),

  // --- Bank transfer + QR (Phase 15) ----------------------------------------
  getOfficeBankDetails: () =>
    api.get<OfficeBankDetails>('/finance/bank-details'),
  officeQrUrl: () => '/api/v1/finance/office-qr.svg',
  invoiceQrUrl: (id: string) => `/api/v1/invoices/${id}/qr.svg`,

  // --- Reports -----------------------------------------------------------
  listOutstanding: (params?: Partial<OutstandingQuery>) =>
    api.get<Paginated<OutstandingRow>>('/finance/outstanding', {
      params: params as Params,
    }),
  summary: (params?: Partial<FinanceSummaryQuery>) =>
    api.get<FinanceSummary>('/finance/summary', { params }),
}
