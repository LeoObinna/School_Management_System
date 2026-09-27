/**
 * Teacher self-service API access layer (README §17, Phase 7).
 * Centralized typed wrappers for the teacher-facing Nitro routes.
 */
import { api } from './api'
import type {
  MyStudentListQuery,
  SubmissionsToGradeQuery,
  TeacherPerformanceQuery,
} from '~/shared/schemas'
import type {
  Paginated,
  TeacherAssignmentToGradeRow,
  TeacherClassAssignmentDetail,
  TeacherPerformanceRow,
  TeacherSelf,
  TeacherStudentRow,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const teachersApi = {
  // --- Self-service dashboard ---------------------------------------------
  getMe: () => api.get<TeacherSelf>('/teachers/me'),

  listMyClasses: (params?: Params) =>
    api.get<{ data: TeacherClassAssignmentDetail[] }>(
      '/teacher-assignments/me',
      { params },
    ),

  listMyStudents: (params?: MyStudentListQuery) =>
    api.get<Paginated<TeacherStudentRow>>('/teachers/me/students', {
      params: params as Params,
    }),

  listSubmissionsToGrade: (params?: SubmissionsToGradeQuery) =>
    api.get<{ data: TeacherAssignmentToGradeRow[] }>(
      '/teachers/me/to-grade',
      { params: params as Params },
    ),

  /** Phase 16C published-score aggregates for one of my classes. */
  getPerformance: (params: TeacherPerformanceQuery) =>
    api.get<TeacherPerformanceRow[]>('/teachers/me/performance', {
      params: params as Params,
    }),
}
