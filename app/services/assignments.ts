/**
 * Assignments, submissions and learning-resource API access layer
 * (README §17, Phase 6).
 *
 * File uploads use multipart/form-data (the browser sets the boundary);
 * downloads are same-origin GET URLs — the session cookie authorizes
 * them and the browser handles streaming/saving.
 */
import { api, apiFetch } from './api'
import { useRuntimeConfig } from '#imports'
import type {
  AssignmentCreate,
  AssignmentListQuery,
  AssignmentUpdate,
  MyAssignmentListQuery,
  ResourceUpdate,
  SubmissionGrade,
} from '~/shared/schemas'
import type {
  AssignmentDetail,
  AssignmentListItem,
  AssignmentSubmission,
  LearningResourceListItem,
  SubmissionDetail,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBaseUrl}${path}`
}

export const assignmentsApi = {
  list: (params?: Partial<AssignmentListQuery>) =>
    api.get<{ data: AssignmentListItem[] }>('/assignments', { params }),
  get: (id: string) =>
    api.get<AssignmentDetail>(`/assignments/${id}`),
  create: (body: AssignmentCreate) =>
    api.post<AssignmentDetail>('/assignments', body),
  update: (id: string, body: AssignmentUpdate) =>
    api.put<AssignmentDetail>(`/assignments/${id}`, body),
  remove: (id: string) =>
    api.del<{ ok: boolean }>(`/assignments/${id}`),

  // Attachments
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetch(`/assignments/${id}/attachments`, {
      method: 'POST',
      body: form,
    })
  },
  removeAttachment: (assignmentId: string, attachmentId: string) =>
    api.del<{ ok: boolean }>(
      `/assignments/${assignmentId}/attachments/${attachmentId}`,
    ),
  attachmentUrl: (assignmentId: string, attachmentId: string) =>
    apiUrl(`/assignments/${assignmentId}/attachments/${attachmentId}`),

  // Teacher grading view
  listSubmissions: (assignmentId: string, params?: Params) =>
    api.get<{ data: SubmissionDetail[] }>(
      `/assignments/${assignmentId}/submissions`,
      { params },
    ),
  gradeSubmission: (
    assignmentId: string,
    studentId: string,
    body: SubmissionGrade,
  ) =>
    apiFetch(`/assignments/${assignmentId}/submissions/${studentId}/grade`, {
      method: 'POST',
      body,
    }),
  submissionFileUrl: (assignmentId: string, studentId: string) =>
    apiUrl(`/assignments/${assignmentId}/submissions/${studentId}/download`),

  // Student work
  listMyAssignments: (params?: Partial<MyAssignmentListQuery>) =>
    api.get<{ data: AssignmentListItem[] }>('/my/assignments', { params }),
  getMySubmission: (assignmentId: string) =>
    apiFetch<AssignmentSubmission | { data: null } | null>(
      `/assignments/${assignmentId}/submission`,
    ),
  saveTextSubmission: (assignmentId: string, body: {
    textContent?: string | null
    removeFile?: boolean
  }) =>
    api.put<AssignmentSubmission>(
      `/assignments/${assignmentId}/submission`,
      body,
    ),
  uploadSubmission: (
    assignmentId: string,
    file: File,
    textContent?: string,
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (textContent !== undefined) {
      form.append('textContent', textContent)
    }
    return apiFetch<AssignmentSubmission>(
      `/assignments/${assignmentId}/submission`,
      { method: 'PUT', body: form },
    )
  },
  submit: (assignmentId: string) =>
    apiFetch<AssignmentSubmission>(
      `/assignments/${assignmentId}/submission/submit`,
      { method: 'POST' },
    ),
  mySubmissionFileUrl: (assignmentId: string) =>
    apiUrl(`/assignments/${assignmentId}/submission/download`),
}

export interface ResourceUploadInput {
  title: string
  description?: string | null
  classId?: string | null
  subjectId?: string | null
  isPublished?: boolean
}

export const resourcesApi = {
  list: (params?: Params) =>
    api.get<{ data: LearningResourceListItem[] }>('/resources', { params }),
  upload: (input: ResourceUploadInput, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('title', input.title)
    if (input.description) {
      form.append('description', input.description)
    }
    if (input.classId) {
      form.append('classId', input.classId)
    }
    if (input.subjectId) {
      form.append('subjectId', input.subjectId)
    }
    form.append('isPublished', String(input.isPublished ?? true))
    return apiFetch<LearningResourceListItem>('/resources', {
      method: 'POST',
      body: form,
    })
  },
  update: (id: string, body: ResourceUpdate) =>
    api.put<LearningResourceListItem>(`/resources/${id}`, body),
  remove: (id: string) =>
    api.del<{ ok: boolean }>(`/resources/${id}`),
  downloadUrl: (id: string) => apiUrl(`/resources/${id}/download`),
}
