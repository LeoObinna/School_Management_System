import { describe, it, expect } from 'vitest'
import { hasPermission } from '../permissions'

describe('hasPermission', () => {
  it('denies anonymous holders', () => {
    expect(hasPermission(null, 'students.view')).toBe(false)
    expect(hasPermission(undefined, 'students.view')).toBe(false)
  })

  it('allows an explicitly granted permission', () => {
    const holder = { roles: ['teacher'], permissions: ['students.view'] }
    expect(hasPermission(holder, 'students.view')).toBe(true)
  })

  it('denies a permission that was not granted', () => {
    const holder = { roles: ['teacher'], permissions: ['students.view'] }
    expect(hasPermission(holder, 'fees.manage_structure')).toBe(false)
  })

  it('grants every permission to super_admin even without explicit rows', () => {
    const holder = { roles: ['super_admin'], permissions: [] }
    expect(hasPermission(holder, 'audit_logs.view')).toBe(true)
    expect(hasPermission(holder, 'payments.refund')).toBe(true)
  })

  it('keeps ordinary roles strictly limited (no finance for teachers)', () => {
    const holder = {
      roles: ['teacher'],
      permissions: ['attendance.mark', 'assignments.create'],
    }
    expect(hasPermission(holder, 'attendance.mark')).toBe(true)
    expect(hasPermission(holder, 'payments.verify')).toBe(false)
  })

  it('evaluates each role independently in multi-role holders', () => {
    const holder = { roles: ['teacher', 'parent'], permissions: ['fees.view'] }
    expect(hasPermission(holder, 'fees.view')).toBe(true)
    expect(hasPermission(holder, 'roles.manage')).toBe(false)
  })
})
