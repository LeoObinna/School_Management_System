/**
 * Timetable + attendance API access layer (README §15–16, Phase 5).
 * Centralized typed wrappers for the Nitro schedule routes.
 */
import { api } from './api'
import type {
  AttendanceMarkBody,
  AttendanceReportQuery,
  AttendanceSessionCreate,
  AttendanceSessionUpdate,
  StudentAttendanceQuery,
  TimetableCreate,
  TimetableListQuery,
  TimetableUpdate,
} from '~/shared/schemas'
import type {
  AttendanceReportRow,
  AttendanceSessionDetail,
  AttendanceSessionListItem,
  Paginated,
  StudentAttendanceDay,
  StudentAttendanceSummary,
  TimetableEntryDetail,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const scheduleApi = {
  // --- Timetable ----------------------------------------------------------
  listTimetable: (params?: Partial<TimetableListQuery>) =>
    api.get<{ data: TimetableEntryDetail[]; total: number }>('/timetable', {
      params,
    }),
  getTimetableEntry: (id: string) =>
    api.get<TimetableEntryDetail>(`/timetable/${id}`),
  createTimetableEntry: (body: TimetableCreate) =>
    api.post<TimetableEntryDetail>('/timetable', body),
  updateTimetableEntry: (id: string, body: TimetableUpdate) =>
    api.put<TimetableEntryDetail>(`/timetable/${id}`, body),
  removeTimetableEntry: (id: string) =>
    api.del<{ message: string }>(`/timetable/${id}`),

  // --- Attendance registers ----------------------------------------------
  listSessions: (params?: Params) =>
    api.get<Paginated<AttendanceSessionListItem>>(
      '/attendance/sessions',
      { params },
    ),
  createSession: (body: AttendanceSessionCreate) =>
    api.post<AttendanceSessionDetail>('/attendance/sessions', body),
  getSession: (id: string) =>
    api.get<AttendanceSessionDetail>(`/attendance/sessions/${id}`),
  updateSession: (id: string, body: AttendanceSessionUpdate) =>
    api.put<AttendanceSessionDetail>(`/attendance/sessions/${id}`, body),
  removeSession: (id: string) =>
    api.del<{ message: string }>(`/attendance/sessions/${id}`),
  markAttendance: (id: string, body: AttendanceMarkBody) =>
    api.put<AttendanceSessionDetail>(
      `/attendance/sessions/${id}/records`,
      body,
    ),
  submitSession: (id: string) =>
    api.post<AttendanceSessionDetail>(
      `/attendance/sessions/${id}/submit`,
    ),
  approveSession: (id: string) =>
    api.post<AttendanceSessionDetail>(
      `/attendance/sessions/${id}/approve`,
    ),

  // --- Reports ------------------------------------------------------------
  classReport: (params: AttendanceReportQuery) =>
    api.get<{ data: AttendanceReportRow[] }>('/attendance/report', {
      params,
    }),
  studentAttendance: (studentId: string, params: StudentAttendanceQuery) =>
    api.get<{ summary: StudentAttendanceSummary; data: StudentAttendanceDay[] }>(
      `/attendance/students/${studentId}`,
      { params },
    ),
}
