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
