/**
 * Academic foundation API access layer (README §10: centralized —
 * components never call $fetch directly). Mirrors the Phase 3 Nitro
 * routes under /api/v1.
 */
import { api } from './api'
import type {
  AcademicSession,
  ClassSubjectDetail,
  ClassSubject as ClassSubjectRow,
  Paginated,
  SchoolClass,
  Section,
  Subject,
  TeacherClassAssignmentDetail,
  TeacherSubjectDetail,
  Term,
} from '~/shared/types'
import type {
  AcademicSessionCreate,
  AcademicSessionUpdate,
  ClassCreate,
  ClassSubjectBody,
  ClassSubjectUpdate,
  ClassUpdate,
  SectionCreate,
  SectionUpdate,
  SubjectCreate,
  SubjectUpdate,
  TeacherAssignmentCreate,
  TeacherSubjectBody,
  TermCreate,
  TermUpdate,
} from '~/shared/schemas'

export interface TeacherLookup {
  id: string
  staffNumber: string
  name: string
}

export interface ClassDetail extends SchoolClass {
  sections: Section[]
  subjects: ClassSubjectDetail[]
}

type Params = Record<string, string | number | boolean | undefined>

export const academicsApi = {
  // --- Sessions -----------------------------------------------------------
  listSessions: (params?: Params) =>
    api.get<Paginated<AcademicSession>>('/academic-sessions', { params }),
  currentSession: () =>
    api.get<AcademicSession>('/academic-sessions/current'),
  createSession: (body: AcademicSessionCreate) =>
    api.post<AcademicSession>('/academic-sessions', body),
  updateSession: (id: string, body: AcademicSessionUpdate) =>
    api.put<AcademicSession>(`/academic-sessions/${id}`, body),
  deactivateSession: (id: string) =>
    api.del<AcademicSession>(`/academic-sessions/${id}`),

  // --- Terms --------------------------------------------------------------
  listTerms: (params?: Params) =>
    api.get<Paginated<Term>>('/terms', { params }),
  createTerm: (body: TermCreate) => api.post<Term>('/terms', body),
  updateTerm: (id: string, body: TermUpdate) =>
    api.put<Term>(`/terms/${id}`, body),
  deactivateTerm: (id: string) => api.del<Term>(`/terms/${id}`),

  // --- Classes ------------------------------------------------------------
  listClasses: (params?: Params) =>
    api.get<Paginated<SchoolClass>>('/classes', { params }),
  getClass: (id: string) => api.get<ClassDetail>(`/classes/${id}`),
  createClass: (body: ClassCreate) =>
    api.post<SchoolClass>('/classes', body),
  updateClass: (id: string, body: ClassUpdate) =>
    api.put<SchoolClass>(`/classes/${id}`, body),
  deactivateClass: (id: string) =>
    api.del<SchoolClass>(`/classes/${id}`),

  // --- Sections -----------------------------------------------------------
  listSections: (params?: Params) =>
    api.get<Paginated<Section>>('/sections', { params }),
  createSection: (body: SectionCreate) =>
    api.post<Section>('/sections', body),
  updateSection: (id: string, body: SectionUpdate) =>
    api.put<Section>(`/sections/${id}`, body),
  deactivateSection: (id: string) =>
    api.del<Section>(`/sections/${id}`),

  // --- Subjects -----------------------------------------------------------
  listSubjects: (params?: Params) =>
    api.get<Paginated<Subject>>('/subjects', { params }),
  createSubject: (body: SubjectCreate) =>
    api.post<Subject>('/subjects', body),
  updateSubject: (id: string, body: SubjectUpdate) =>
    api.put<Subject>(`/subjects/${id}`, body),
  deactivateSubject: (id: string) =>
    api.del<Subject>(`/subjects/${id}`),

  // --- Class subjects -----------------------------------------------------
  listClassSubjects: (classId: string) =>
    api.get<ClassSubjectDetail[]>(`/classes/${classId}/subjects`),
  addClassSubject: (classId: string, body: ClassSubjectBody) =>
    api.post<ClassSubjectRow>(`/classes/${classId}/subjects`, body),
  updateClassSubject: (
    classId: string,
    subjectId: string,
    body: ClassSubjectUpdate,
  ) =>
    api.put<ClassSubjectRow>(
      `/classes/${classId}/subjects/${subjectId}`,
      body,
    ),
  removeClassSubject: (classId: string, subjectId: string) =>
    api.del<{ message: string }>(
      `/classes/${classId}/subjects/${subjectId}`,
    ),

  // --- Teacher lookup / teacher subjects ---------------------------------
  listTeachers: () =>
    api.get<{ data: TeacherLookup[] }>('/teachers'),
  listTeacherSubjects: (teacherId: string) =>
    api.get<{ data: TeacherSubjectDetail[] }>('/teacher-subjects', {
      params: { teacherId },
    }),
  addTeacherSubject: (body: TeacherSubjectBody) =>
    api.post('/teacher-subjects', body),
  removeTeacherSubject: (teacherId: string, subjectId: string) =>
    api.del<{ message: string }>(
      `/teacher-subjects/${teacherId}/${subjectId}`,
    ),

  // --- Teacher class assignments -----------------------------------------
  listAssignments: (params?: Params) =>
    api.get<{ data: TeacherClassAssignmentDetail[] }>(
      '/teacher-assignments',
      { params },
    ),
  createAssignment: (body: TeacherAssignmentCreate) =>
    api.post<TeacherClassAssignmentDetail>(
      '/teacher-assignments',
      body,
    ),
  removeAssignment: (id: string) =>
    api.del<{ message: string }>(`/teacher-assignments/${id}`),
}
