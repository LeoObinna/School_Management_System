/**
 * Phase 6 validation contract tests for admin user/role schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  userCreateSchema,
  userUpdateSchema,
  userListQuerySchema,
  adminResetPasswordSchema,
  userRolesUpdateSchema,
  roleListQuerySchema,
  roleIdParamSchema,
} from '../schemas'

const UUID = '00000000-0000-4000-8000-000000000001'
const UUID2 = '00000000-0000-4000-8000-000000000002'

describe('userCreateSchema', () => {
  it('requires name, email and a minimum-8-char password', () => {
    expect(
      userCreateSchema.safeParse({
        name: 'Ada Okafor',
        email: 'ada@example.com',
        password: 'secret123',
      }).success,
    ).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(
      userCreateSchema.safeParse({
        name: 'Ada',
        email: 'not-an-email',
        password: 'secret123',
      }).success,
    ).toBe(false)
  })

  it('rejects a 7-character password', () => {
    expect(
      userCreateSchema.safeParse({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'seven77',
      }).success,
    ).toBe(false)
  })

  it('accepts the optional gender/phone/isActive fields', () => {
    expect(
      userCreateSchema.safeParse({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret123',
        phone: '+234 802 000 0000',
        gender: 'female',
        isActive: false,
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown gender value', () => {
    expect(
      userCreateSchema.safeParse({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret123',
        gender: 'other_value',
      }).success,
    ).toBe(false)
  })
})

describe('userUpdateSchema', () => {
  it('rejects an empty partial', () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a single field update', () => {
    expect(
      userUpdateSchema.safeParse({ isActive: false }).success,
    ).toBe(true)
  })

  it('accepts a password change alone', () => {
    expect(
      userUpdateSchema.safeParse({ password: 'newpassword' }).success,
    ).toBe(true)
  })
})

describe('userListQuerySchema', () => {
  it('applies pagination defaults', () => {
    const result = userListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.perPage).toBe(20)
      expect(result.data.order).toBe('asc')
    }
  })

  it('accepts a role slug + active filter + search', () => {
    expect(
      userListQuerySchema.safeParse({
        role: 'teacher',
        isActive: 'false',
        search: 'ada',
      }).success,
    ).toBe(true)
  })
})

describe('adminResetPasswordSchema', () => {
  it('requires a minimum-8-char newPassword', () => {
    expect(
      adminResetPasswordSchema.safeParse({ newPassword: 'short' }).success,
    ).toBe(false)
    expect(
      adminResetPasswordSchema.safeParse({ newPassword: 'longenough' })
        .success,
    ).toBe(true)
  })
})

describe('userRolesUpdateSchema', () => {
  it('requires a non-empty UUID array', () => {
    expect(userRolesUpdateSchema.safeParse({ roleIds: [] }).success).toBe(false)
  })

  it('rejects a non-UUID entry', () => {
    expect(
      userRolesUpdateSchema.safeParse({ roleIds: ['not-a-uuid'] }).success,
    ).toBe(false)
  })

  it('accepts up to 10 role ids', () => {
    const ids = Array.from({ length: 10 }, () => UUID)
    expect(
      userRolesUpdateSchema.safeParse({ roleIds: ids }).success,
    ).toBe(true)
  })

  it('rejects more than 10 role ids', () => {
    const ids = Array.from({ length: 11 }, () => UUID)
    expect(
      userRolesUpdateSchema.safeParse({ roleIds: ids }).success,
    ).toBe(false)
  })

  it('accepts a single valid UUID', () => {
    expect(
      userRolesUpdateSchema.safeParse({ roleIds: [UUID] }).success,
    ).toBe(true)
  })

  it('accepts two distinct UUIDs', () => {
    expect(
      userRolesUpdateSchema.safeParse({ roleIds: [UUID, UUID2] }).success,
    ).toBe(true)
  })
})

describe('role schemas', () => {
  it('roleListQuerySchema accepts pagination defaults', () => {
    const result = roleListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.perPage).toBe(20)
    }
  })

  it('roleIdParamSchema requires a UUID', () => {
    expect(roleIdParamSchema.safeParse({ id: 'x' }).success).toBe(false)
    expect(roleIdParamSchema.safeParse({ id: UUID }).success).toBe(true)
  })
})
