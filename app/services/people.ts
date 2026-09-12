/**
 * People + enrollment API access layer (README §14, Phase 4).
 * Centralized typed wrappers for the Nitro people routes.
 */
import { api } from './api'
import type {
  EnrollmentCreate,
  EnrollmentUpdate,
  ParentCreate,
  ParentUpdate,
  StaffCreate,
  StaffUpdate,
  StudentCreate,
  StudentParentBody,
  StudentParentUpdate,
  StudentUpdate,
  TeacherCreate,
  TeacherUpdate,
} from '~/shared/schemas'
import type {
  Paginated,
  Parent,
  ParentChildDetail,
  StaffProfile,
  Student,
  StudentEnrollmentDetail,
  StudentParent as StudentParentRow,
  StudentParentDetail,
  Teacher,
} from '~/shared/types'

type Params = Record<string, string | number | boolean | undefined>

export const peopleApi = {
  // --- Students -----------------------------------------------------------
  listStudents: (params?: Params) =>
    api.get<Paginated<Student>>('/students', { params }),
  getStudent: (id: string) => api.get<Student>(`/students/${id}`),
  createStudent: (body: StudentCreate) =>
    api.post<Student>('/students', body),
  updateStudent: (id: string, body: StudentUpdate) =>
    api.put<Student>(`/students/${id}`, body),
  archiveStudent: (id: string) =>
    api.del<{ message: string }>(`/students/${id}`),
  listStudentParents: (studentId: string) =>
    api.get<{ data: StudentParentDetail[] }>(
      `/students/${studentId}/parents`,
    ),
  addStudentParent: (studentId: string, body: StudentParentBody) =>
    api.post<StudentParentRow>(
      `/students/${studentId}/parents`,
      body,
    ),
  updateStudentParent: (
    studentId: string,
    parentId: string,
    body: StudentParentUpdate,
  ) =>
    api.put<StudentParentRow>(
      `/students/${studentId}/parents/${parentId}`,
      body,
    ),
  removeStudentParent: (studentId: string, parentId: string) =>
    api.del<{ message: string }>(
      `/students/${studentId}/parents/${parentId}`,
    ),
  listStudentEnrollments: (studentId: string) =>
    api.get<{
      data: StudentEnrollmentDetail[]
      total: number
    }>(`/students/${studentId}/enrollments`),

  // --- Parents ------------------------------------------------------------
  listParents: (params?: Params) =>
    api.get<Paginated<Parent>>('/parents', { params }),
  getParent: (id: string) => api.get<Parent>(`/parents/${id}`),
  createParent: (body: ParentCreate) =>
    api.post<Parent>('/parents', body),
  updateParent: (id: string, body: ParentUpdate) =>
    api.put<Parent>(`/parents/${id}`, body),
  deactivateParent: (id: string) =>
    api.del<{ message: string }>(`/parents/${id}`),
  listParentChildren: (parentId: string) =>
    api.get<{ data: ParentChildDetail[] }>(
      `/parents/${parentId}/children`,
    ),

  // --- Teachers -----------------------------------------------------------
  listTeachers: (params?: Params) =>
    api.get<Paginated<Teacher>>('/teachers', { params }),
  getTeacher: (id: string) => api.get<Teacher>(`/teachers/${id}`),
  createTeacher: (body: TeacherCreate) =>
    api.post<Teacher>('/teachers', body),
  updateTeacher: (id: string, body: TeacherUpdate) =>
    api.put<Teacher>(`/teachers/${id}`, body),
  deactivateTeacher: (id: string) =>
    api.del<{ message: string }>(`/teachers/${id}`),

  // --- Staff --------------------------------------------------------------
  listStaff: (params?: Params) =>
    api.get<Paginated<StaffProfile>>('/staff', { params }),
  getStaff: (id: string) => api.get<StaffProfile>(`/staff/${id}`),
  createStaff: (body: StaffCreate) =>
    api.post<StaffProfile>('/staff', body),
  updateStaff: (id: string, body: StaffUpdate) =>
    api.put<StaffProfile>(`/staff/${id}`, body),
  deactivateStaff: (id: string) =>
    api.del<{ message: string }>(`/staff/${id}`),

  // --- Enrollments --------------------------------------------------------
  listEnrollments: (params?: Params) =>
    api.get<{ data: StudentEnrollmentDetail[]; total: number }>(
      '/enrollments',
      { params },
    ),
  createEnrollment: (body: EnrollmentCreate) =>
    api.post<StudentEnrollmentDetail>('/enrollments', body),
  updateEnrollment: (id: string, body: EnrollmentUpdate) =>
    api.put<StudentEnrollmentDetail>(`/enrollments/${id}`, body),
  removeEnrollment: (id: string) =>
    api.del<{ message: string }>(`/enrollments/${id}`),
}
