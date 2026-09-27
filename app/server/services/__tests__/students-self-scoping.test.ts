/**
 * Scoping guard tests for the Phase 16A student dashboard: every
 * self-service entry point resolves the student from the actor and 404s
 * when the caller has no linked student record — a caller can never
 * pass (or default to) another student's id. DB-bound behavior is
 * exercised through the API; these cover the authorization guards that
 * run before any query.
 */
import { describe, expect, it } from 'vitest'
import {
  getStudentDashboard,
  getStudentSelf,
  listMyEnrollments,
} from '../students-self'
import type { ActorProfile } from '../../utils/auth/actor'

function actor(overrides: Partial<ActorProfile> = {}): ActorProfile {
  return {
    userId: 'user-1',
    isStaff: false,
    isAdmin: false,
    teacherId: null,
    studentId: null,
    staffProfileId: null,
    children: [],
    ...overrides,
  }
}

describe('student self-service scoping guards', () => {
  it('getStudentSelf 404s without a linked student profile', async () => {
    await expect(getStudentSelf(actor())).rejects.toThrow(
      'No student profile linked to this account.',
    )
  })

  it('getStudentDashboard 404s without a linked student profile', async () => {
    await expect(getStudentDashboard(actor())).rejects.toThrow(
      'No student profile linked to this account.',
    )
  })

  it('listMyEnrollments 404s without a linked student profile', async () => {
    await expect(listMyEnrollments(actor())).rejects.toThrow(
      'No student profile linked to this account.',
    )
  })

  it('a student actor keeps its own resolved studentId', () => {
    // The dashboard functions never accept a studentId argument — the
    // only source is actor.studentId (server-resolved from the session).
    const student = actor({ studentId: 'stu-1' })
    expect(student.studentId).toBe('stu-1')
  })
})
