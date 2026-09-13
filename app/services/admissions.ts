/**
 * Admissions API access layer (README §20, Phase 9).
 * Centralized — components never call $fetch directly.
 */
import { api } from './api'
import type {
  AdmissionApplicationDetail,
  AdmissionApplicationListItem,
  AdmissionEnrollResult,
  Paginated,
} from '~/shared/types'
import type {
  ApplicationCreate,
  ApplicationDecision,
  ApplicationEnroll,
  ApplicationListQuery,
  ApplicationReview,
  ApplicationUpdate,
  ApplicationWaitlist,
  AssessmentCreate,
  AssessmentUpdate,
} from '~/shared/schemas'

type Params = Record<string, string | number | boolean | undefined>

function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBaseUrl}${path}`
}

export const admissionsApi = {
  // --- Applications ------------------------------------------------------
  listApplications: (params?: Partial<ApplicationListQuery>) =>
    api.get<Paginated<AdmissionApplicationListItem>>('/admissions', {
      params: params as Params,
    }),
  getApplication: (id: string) =>
    api.get<AdmissionApplicationDetail>(`/admissions/${id}`),
  createApplication: (body: ApplicationCreate) =>
    api.post<AdmissionApplicationDetail>('/admissions', body),
  updateApplication: (id: string, body: ApplicationUpdate) =>
    api.put<AdmissionApplicationDetail>(`/admissions/${id}`, body),

  // --- Workflow ----------------------------------------------------------
  review: (id: string, body: ApplicationReview = {}) =>
    api.post<AdmissionApplicationDetail>(`/admissions/${id}/review`, body),
  approve: (id: string, body: ApplicationDecision) =>
    api.post<AdmissionApplicationDetail>(`/admissions/${id}/approve`, body),
  reject: (id: string, body: ApplicationDecision) =>
    api.post<AdmissionApplicationDetail>(`/admissions/${id}/reject`, body),
  waitlist: (id: string, body: ApplicationWaitlist = {}) =>
    api.post<AdmissionApplicationDetail>(
      `/admissions/${id}/waitlist`,
      body,
    ),
  withdraw: (id: string, body: ApplicationWaitlist = {}) =>
    api.post<AdmissionApplicationDetail>(
      `/admissions/${id}/withdraw`,
      body,
    ),
  enroll: (id: string, body: ApplicationEnroll) =>
    api.post<AdmissionEnrollResult>(`/admissions/${id}/enroll`, body),

  // --- Assessments / interviews -----------------------------------------
  addAssessment: (id: string, body: AssessmentCreate) =>
    api.post<AdmissionApplicationDetail>(
      `/admissions/${id}/assessments`,
      body,
    ),
  updateAssessment: (
    id: string,
    assessmentId: string,
    body: AssessmentUpdate,
  ) =>
    api.put<AdmissionApplicationDetail>(
      `/admissions/${id}/assessments/${assessmentId}`,
      body,
    ),
  deleteAssessment: (id: string, assessmentId: string) =>
    api.del<AdmissionApplicationDetail>(
      `/admissions/${id}/assessments/${assessmentId}`,
    ),

  // --- Documents (R2) ----------------------------------------------------
  // FormData parts: `file` (the bytes) and `documentType` (text).
  // ofetch sets the multipart boundary; do not set Content-Type.
  uploadDocument: (id: string, form: FormData) =>
    api.post<AdmissionApplicationDetail>(
      `/admissions/${id}/documents`,
      form,
    ),
  deleteDocument: (id: string, documentId: string) =>
    api.del<AdmissionApplicationDetail>(
      `/admissions/${id}/documents/${documentId}`,
    ),
  // Same-origin GET carrying the session cookie (auth required).
  documentUrl: (id: string, documentId: string) =>
    apiUrl(`/admissions/${id}/documents/${documentId}`),
}
