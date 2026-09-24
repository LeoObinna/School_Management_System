/**
 * Student self-service API access layer (README §17, Phase 8).
 * Centralized typed wrappers for the student-facing Nitro routes.
 *
 * The studentId is resolved server-side on every call; the client never
 * sends one. A 404 from /students/me means "no student profile linked to
 * this account" — callers should treat it as "no student widget" rather
 * than an error (mirrors the teacher widget pattern on pages/index.vue).
 */
import { api } from './api'
import type { MyResultsQuery, MyTimetableQuery } from '~/shared/schemas'
import type {
  StudentSelf,
  StudentActiveEnrollment,
  TimetableEntryDetail,
} from '~/shared/types'
import type { StudentResultSummary } from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const studentsApi = {
  // --- Self-service dashboard ---------------------------------------------
  getMe: () => api.get<StudentSelf>('/students/me'),

  listMyTimetable: (params?: Params | MyTimetableQuery) =>
    api.get<{ data: TimetableEntryDetail[]; total: number }>(
      '/students/me/timetable',
      { params: params as Params },
    ),

  getMyResults: (params: MyResultsQuery) =>
    api.get<StudentResultSummary>('/students/me/results', {
      params: params as Params,
    }),
}

// Re-export the active-enrollment shape for the page's typed refs.
export type { StudentSelf, StudentActiveEnrollment }
