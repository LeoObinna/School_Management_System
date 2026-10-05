/**
 * Phase 16A login-redirect routing: student/parent/teacher roles land
 * on their portal home; staff/admin keep the staff dashboard. Pure
 * functions — mirrors the owner decision recorded in the Phase 16 plan.
 * Phase 18A: the staff dashboard moved from `/` to `/dashboard` (the
 * public website owns `/`).
 */
import { describe, expect, it } from 'vitest'
import {
  landingPathForRoles,
  primaryPortalRole,
} from '../portal'
import type { RoleSlug } from '~/shared/types'

function roles(...slugs: RoleSlug[]): RoleSlug[] {
  return slugs
}

describe('primaryPortalRole', () => {
  it('returns null for staff and admin roles', () => {
    expect(primaryPortalRole(roles('super_admin'))).toBeNull()
    expect(primaryPortalRole(roles('admin'))).toBeNull()
  })

  it('still returns null when a staff role is combined with a portal role', () => {
    // An admin who also has a teacher profile keeps the staff dashboard.
    expect(primaryPortalRole(roles('admin', 'teacher'))).toBeNull()
    expect(primaryPortalRole(roles('super_admin', 'student'))).toBeNull()
  })

  it('maps each portal role to itself', () => {
    expect(primaryPortalRole(roles('teacher'))).toBe('teacher')
    expect(primaryPortalRole(roles('parent'))).toBe('parent')
    expect(primaryPortalRole(roles('student'))).toBe('student')
  })

  it('prefers teacher over parent and student when several resolve', () => {
    expect(primaryPortalRole(roles('parent', 'teacher'))).toBe('teacher')
    expect(
      primaryPortalRole(roles('student', 'parent', 'teacher')),
    ).toBe('teacher')
  })

  it('prefers parent over student', () => {
    expect(primaryPortalRole(roles('student', 'parent'))).toBe('parent')
  })

  it('returns null for unknown or empty role lists', () => {
    expect(primaryPortalRole([])).toBeNull()
  })
})

describe('landingPathForRoles', () => {
  it('sends portal roles to their /portal/* home', () => {
    expect(landingPathForRoles(roles('student'))).toBe('/portal/student')
    expect(landingPathForRoles(roles('parent'))).toBe('/portal/parent')
    expect(landingPathForRoles(roles('teacher'))).toBe('/portal/teacher')
  })

  it('sends staff and unknown users to the staff dashboard', () => {
    expect(landingPathForRoles(roles('super_admin'))).toBe('/dashboard')
    expect(landingPathForRoles(roles('admin'))).toBe('/dashboard')
    expect(landingPathForRoles([])).toBe('/dashboard')
  })
})
