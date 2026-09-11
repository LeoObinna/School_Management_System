/**
 * Tests for the RBAC seed catalog: permission uniqueness/format and the
 * invariant that every role references permissions that actually exist.
 */
import { describe, it, expect } from 'vitest'
import {
  PERMISSION_SLUGS,
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
} from '../catalog'

describe('permission catalog', () => {
  it('has unique slugs', () => {
    expect(new Set(PERMISSION_SLUGS).size).toBe(PERMISSION_SLUGS.length)
  })

  it('uses dotted resource.action slugs', () => {
    for (const slug of PERMISSION_SLUGS) {
      expect(slug).toMatch(/^[a-z_]+(\.[a-z_]+)+$/)
    }
  })

  it('derives a group and human name for every permission', () => {
    expect(PERMISSIONS).toHaveLength(PERMISSION_SLUGS.length)
    for (const p of PERMISSIONS) {
      expect(p.group.length).toBeGreaterThan(0)
      expect(p.name.length).toBeGreaterThan(0)
    }
  })
})

describe('role catalog', () => {
  it('defines the five initial roles', () => {
    expect(ROLES.map((r) => r.slug)).toEqual([
      'super_admin',
      'admin',
      'teacher',
      'student',
      'parent',
    ])
  })

  it('only references existing permission slugs', () => {
    const known = new Set<string>(PERMISSION_SLUGS)
    for (const role of ROLES) {
      for (const slug of ROLE_PERMISSIONS[role.slug]) {
        expect(known.has(slug)).toBe(true)
      }
    }
  })

  it('grants super admin every permission', () => {
    expect(ROLE_PERMISSIONS.super_admin).toHaveLength(PERMISSION_SLUGS.length)
  })

  it('never grants teachers or students finance permissions', () => {
    const finance = (slugs: readonly string[]) =>
      slugs.filter(
        (s) =>
          s.startsWith('fees.') ||
          s.startsWith('invoices.') ||
          s.startsWith('payments.') ||
          s.startsWith('receipts.') ||
          s === 'finance.export',
      )
    expect(finance(ROLE_PERMISSIONS.teacher)).toHaveLength(0)
    expect(finance(ROLE_PERMISSIONS.student)).toHaveLength(0)
  })
})
