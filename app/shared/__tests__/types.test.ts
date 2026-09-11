/**
 * Smoke test verifying the test runner and shared types work.
 * More tests are added per module in later phases.
 */
import { describe, it, expect } from 'vitest'
import type { RoleSlug, ResultStatus, AttendanceStatus, StudentStatus } from '../types'

describe('shared types', () => {
  it('includes the five initial roles', () => {
    const roles: RoleSlug[] = ['super_admin', 'admin', 'teacher', 'student', 'parent']
    expect(roles).toHaveLength(5)
  })

  it('result workflow has four states', () => {
    const states: ResultStatus[] = ['draft', 'submitted', 'approved', 'published']
    expect(states).toHaveLength(4)
  })

  it('attendance has four statuses', () => {
    const statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']
    expect(statuses).toHaveLength(4)
  })

  it('student lifecycle covers all states', () => {
    const statuses: StudentStatus[] = [
      'applicant', 'admitted', 'enrolled', 'active',
      'graduated', 'transferred', 'withdrawn', 'archived',
    ]
    expect(statuses).toHaveLength(8)
  })
})
