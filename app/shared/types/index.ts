/**
 * Shared TypeScript types used by both client (app/) and server (server/).
 *
 * These types describe the core domain entities. More types are added
 * per module in Phase 1+.
 */

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  service: string
  version: string
  timestamp: string
  database: boolean
}

export interface ApiErrorShape {
  message: string
  status: number | null
  errors?: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// Auth & Users
// ---------------------------------------------------------------------------

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  isActive: boolean
  emailVerifiedAt?: string | null
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  slug: string
  description?: string | null
  createdAt: string
  updatedAt: string
}

// Authenticated user as returned by the API — never includes password.
export interface AuthUser {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  isActive: boolean
}

// GET /api/v1/auth/me
export interface AuthSessionResponse {
  user: AuthUser
  roles: RoleSlug[]
  permissions: string[]
  csrfToken: string
}

// POST /api/v1/auth/login
export type LoginResponse = AuthSessionResponse

export interface MessageResponse {
  message: string
}

export interface Permission {
  id: string
  name: string
  slug: string
  group?: string | null
  description?: string | null
}

// Initial roles per README §7
export type RoleSlug =
  | 'super_admin'
  | 'admin'
  | 'teacher'
  | 'student'
  | 'parent'

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  data: T[]
  meta: {
    currentPage: number
    perPage: number
    total: number
    lastPage: number
  }
}

// ---------------------------------------------------------------------------
// Academic foundation (README §13, Phase 3)
// ---------------------------------------------------------------------------

export interface AcademicSession {
  id: string
  name: string
  slug: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Term {
  id: string
  sessionId: string
  name: string
  slug: string
  sequence: number
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SchoolClass {
  id: string
  name: string
  slug: string
  level: string | null
  sequence: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string
  classId: string
  name: string
  slug: string
  capacity: number | null
  room: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Subject {
  id: string
  name: string
  slug: string
  code: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ClassSubject {
  classId: string
  subjectId: string
  isCompulsory: boolean
  maxScore: number | null
  createdAt: string
}

// Class-subject row joined with the subject catalog.
export interface ClassSubjectDetail extends ClassSubject {
  subject: Subject
}

export interface TeacherSubject {
  teacherId: string
  subjectId: string
  createdAt: string
}

export interface TeacherSubjectDetail extends TeacherSubject {
  subject: Subject
}

export interface TeacherClassAssignment {
  id: string
  teacherId: string
  classId: string
  sectionId: string | null
  subjectId: string
  sessionId: string
  isPrimaryTeacher: boolean
  createdAt: string
}

// Assignment row joined with the related display names.
export interface TeacherClassAssignmentDetail
  extends TeacherClassAssignment {
  teacherName: string
  className: string
  sectionName: string | null
  subjectName: string
  sessionName: string
}

// ---------------------------------------------------------------------------
// Result workflow (README §18)
// ---------------------------------------------------------------------------

export type ResultStatus = 'draft' | 'submitted' | 'approved' | 'published'

// ---------------------------------------------------------------------------
// Attendance statuses (README §15)
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

// ---------------------------------------------------------------------------
// Student lifecycle (README §14)
// ---------------------------------------------------------------------------

export type StudentStatus =
  | 'applicant'
  | 'admitted'
  | 'enrolled'
  | 'active'
  | 'graduated'
  | 'transferred'
  | 'withdrawn'
  | 'archived'

// ---------------------------------------------------------------------------
// People (README §14, Phase 4)
// ---------------------------------------------------------------------------

export interface Student {
  id: string
  userId: string | null
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  dateOfBirth: string | null
  bloodGroup: string | null
  nationality: string | null
  religion: string | null
  address: string | null
  photoUrl: string | null
  status: StudentStatus
  currentClassId: string | null
  currentSectionId: string | null
  enrolledAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Gender = 'male' | 'female' | 'other'

export interface Parent {
  id: string
  userId: string | null
  firstName: string
  lastName: string
  otherNames: string | null
  email: string | null
  phone: string | null
  gender: string | null
  occupation: string | null
  address: string | null
  photoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Teacher {
  id: string
  userId: string | null
  staffNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  email: string | null
  phone: string | null
  gender: string | null
  qualification: string | null
  specialization: string | null
  address: string | null
  photoUrl: string | null
  hiredAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface StaffProfile {
  id: string
  userId: string | null
  staffNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  jobTitle: string | null
  department: string | null
  email: string | null
  phone: string | null
  gender: string | null
  hiredAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface StudentParent {
  studentId: string
  parentId: string
  relationship: string
  isPrimary: boolean
  isEmergencyContact: boolean
  createdAt: string
}

// Student-parent link joined with the parent profile.
export interface StudentParentDetail extends StudentParent {
  parent: Parent
}

// Parent's children listing (parent id + link joined with student).
export interface ParentChildDetail extends StudentParent {
  student: Student
}

// ---------------------------------------------------------------------------
// Student enrollments (README §14)
// ---------------------------------------------------------------------------

export type EnrollmentStatus =
  | 'active'
  | 'completed'
  | 'promoted'
  | 'repeated'
  | 'withdrawn'

export interface StudentEnrollment {
  id: string
  studentId: string
  sessionId: string
  termId: string | null
  classId: string
  sectionId: string | null
  rollNumber: string | null
  enrollmentDate: string
  status: EnrollmentStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface StudentEnrollmentDetail extends StudentEnrollment {
  studentName: string
  className: string
  sectionName: string | null
  sessionName: string
  termName: string | null
}
