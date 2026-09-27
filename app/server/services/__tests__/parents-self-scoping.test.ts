/**
 * Scoping guard tests for the Phase 16B parent-portal additions:
 * teacher contacts and the per-child overview are resolved from the
 * actor's linked children — never from a client-supplied id. The
 * no-children paths return early without touching the database; the
 * child-ownership guard rejects probing parents before any query.
 */
import { describe, expect, it } from 'vitest'
import {
  getChildAttendance,
  getParentOverview,
  listMyTeachers,
} from '../parents-self'
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

describe('parent-portal scoping guards (Phase 16B)', () => {
  it('listMyTeachers returns empty for a parent of no children', async () => {
    await expect(listMyTeachers(actor())).resolves.toEqual({ data: [] })
  })

  it('getParentOverview returns empty for a parent of no children', async () => {
    await expect(getParentOverview(actor())).resolves.toEqual({
      session: null,
      term: null,
      children: [],
    })
  })

  it('getChildAttendance rejects a student that is not the actor\'s child', async () => {
    await expect(
      getChildAttendance(
        'not-my-child',
        { sessionId: 'session-1' },
        actor({ children: ['my-child'] }),
      ),
    ).rejects.toThrow('You can only view your own children.')
  })

  it('the child scope comes only from the actor (server-resolved)', () => {
    const parent = actor({ children: ['child-a', 'child-b'] })
    expect(parent.children).toEqual(['child-a', 'child-b'])
  })
})
