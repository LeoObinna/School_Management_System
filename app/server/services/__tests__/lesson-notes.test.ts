/**
 * Phase 16D lesson notes: authorization matrix for scope resolution
 * and note management. The service composes these pure helpers with
 * thin DB queries; route-level negatives (non-owner 404, parent 403)
 * are additionally covered by the cf:dev smoke.
 */
import { describe, expect, it } from 'vitest'
import {
  canManageLessonNote,
  resolveLessonNoteScope,
} from '../lesson-notes'
import type { ActorProfile } from '../../utils/auth/actor'

function actor(overrides: Partial<ActorProfile> = {}): ActorProfile {
  return {
    userId: 'user-1',
    teacherId: null,
    studentId: null,
    staffProfileId: null,
    children: [],
    isStaff: true,
    isAdmin: false,
    ...overrides,
  }
}

const note = { teacherId: 'teacher-1' }

describe('resolveLessonNoteScope', () => {
  it('gives admins the all scope', () => {
    expect(resolveLessonNoteScope(actor({ isAdmin: true }))).toEqual({
      kind: 'all',
    })
  })

  it('scopes teachers to their own notes', () => {
    expect(
      resolveLessonNoteScope(actor({ teacherId: 'teacher-1' })),
    ).toEqual({ kind: 'own', teacherId: 'teacher-1' })
  })

  it('resolves no scope for staff without a teacher profile', () => {
    expect(resolveLessonNoteScope(actor())).toEqual({ kind: 'none' })
  })

  it('resolves no scope for parents and students', () => {
    expect(
      resolveLessonNoteScope(
        actor({ isStaff: false, studentId: 'stud-1', children: ['stud-1'] }),
      ),
    ).toEqual({ kind: 'none' })
  })
})

describe('canManageLessonNote', () => {
  it('allows the owning teacher', () => {
    expect(canManageLessonNote(note, actor({ teacherId: 'teacher-1' }))).toBe(
      true,
    )
  })

  it('rejects a different teacher', () => {
    expect(canManageLessonNote(note, actor({ teacherId: 'teacher-2' }))).toBe(
      false,
    )
  })

  it('allows admins regardless of profile', () => {
    expect(canManageLessonNote(note, actor({ isAdmin: true }))).toBe(true)
  })

  it('rejects parents and students', () => {
    expect(canManageLessonNote(note, actor({ isStaff: false }))).toBe(false)
  })
})
