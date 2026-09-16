import { describe, it, expect } from 'vitest'
import { classifyActorScope } from '../../utils/auth/actor'
import type { ActorProfile } from '../../utils/auth/actor'

function profile(
  overrides: Partial<ActorProfile> = {},
): ActorProfile {
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

describe('classifyActorScope', () => {
  it('classifies staff as staff (no row-level constraint)', () => {
    expect(classifyActorScope(profile({ isStaff: true }))).toEqual({
      kind: 'staff',
    })
    // An admin is also staff via isStaff.
    expect(
      classifyActorScope(profile({ isStaff: true, isAdmin: true })),
    ).toEqual({ kind: 'staff' })
  })

  it('classifies a teacher by their teacherId', () => {
    expect(
      classifyActorScope(profile({ teacherId: 't-1' })),
    ).toEqual({ kind: 'teacher', teacherId: 't-1' })
  })

  it('classifies a student by their studentId', () => {
    // A student has no teacherId and is not staff.
    expect(
      classifyActorScope(profile({ studentId: 's-1' })),
    ).toEqual({ kind: 'student', studentId: 's-1' })
  })

  it('classifies a parent by their children', () => {
    expect(
      classifyActorScope(profile({ children: ['s-1', 's-2'] })),
    ).toEqual({ kind: 'parent', children: ['s-1', 's-2'] })
  })

  it('classifies a non-staff caller with no business ids as none', () => {
    expect(classifyActorScope(profile())).toEqual({ kind: 'none' })
  })

  it('prefers staff over teacher/student/parent when isStaff is true', () => {
    // An admin who also has a teacher profile is staff (sees all).
    expect(
      classifyActorScope(
        profile({ isStaff: true, teacherId: 't-1', studentId: 's-1' }),
      ),
    ).toEqual({ kind: 'staff' })
  })

  it('prefers teacher over student when both ids resolve', () => {
    // A user linked to both a teacher and a student profile is treated
    // as a teacher (the staff-adjacent identity).
    expect(
      classifyActorScope(profile({ teacherId: 't-1', studentId: 's-1' })),
    ).toEqual({ kind: 'teacher', teacherId: 't-1' })
  })

  it('treats a parent with no children as none', () => {
    // A parent whose children are all archived/removed sees nothing.
    expect(
      classifyActorScope(profile({ children: [] })),
    ).toEqual({ kind: 'none' })
  })
})
