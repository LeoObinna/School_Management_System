/**
 * Parent self-service API access layer (README §17, Phase 9).
 * Centralized typed wrappers for the parent-facing Nitro routes.
 *
 * The parentId and child list are resolved server-side on every call;
 * the client never sends a parentId. A 404 from /parents/me means "no
 * parent profile linked to this account" — callers should treat it as
 * "no parent widget" rather than an error (mirrors the teacher/student
 * widget pattern on pages/index.vue).
 */
import { api } from './api'
import type {
  MyChildResultsQuery,
  StudentAttendanceQuery,
} from '~/shared/schemas'
import type {
  ParentChildSummary,
  ParentOverview,
  ParentSelf,
  ParentTeacherContact,
  StudentAttendanceDay,
  StudentAttendanceSummary,
  StudentResultSummary,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const parentsApi = {
  // --- Self-service dashboard ---------------------------------------------
  getMe: () => api.get<ParentSelf>('/parents/me'),

  listMyChildren: () =>
    api.get<{ data: ParentChildSummary[] }>('/parents/me/children'),

  /** Phase 16B per-child portal snapshot (progress, attendance, fees). */
  getOverview: () => api.get<ParentOverview>('/parents/me/overview'),

  /** Phase 16B deduped teacher contacts for the message composer. */
  listMyTeachers: () =>
    api.get<{ data: ParentTeacherContact[] }>('/parents/me/teachers'),

  getChildResults: (studentId: string, params: MyChildResultsQuery) =>
    api.get<StudentResultSummary>(
      `/parents/me/children/${studentId}/results`,
      { params: params as Params },
    ),

  getChildAttendance: (
    studentId: string,
    params: StudentAttendanceQuery,
  ) =>
    api.get<{
      summary: StudentAttendanceSummary
      data: StudentAttendanceDay[]
    }>(`/parents/me/children/${studentId}/attendance`, {
      params: params as Params,
    }),
}

export type { ParentSelf, ParentChildSummary }
