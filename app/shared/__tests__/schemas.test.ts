/**
 * Tests for shared zod validation schemas. These guard the validation
 * contract shared by the client and the Nitro server.
 */
import { describe, it, expect } from 'vitest'
import {
  moneyStringSchema,
  loginSchema,
  paginationQuerySchema,
  academicSessionSchema,
  resetPasswordSchema,
} from '../schemas'

describe('moneyStringSchema', () => {
  it('accepts exact decimal amounts', () => {
    expect(moneyStringSchema.safeParse('1200.50').success).toBe(true)
    expect(moneyStringSchema.safeParse('0').success).toBe(true)
  })

  it('rejects values with more than two decimal places', () => {
    expect(moneyStringSchema.safeParse('1.234').success).toBe(false)
  })

  it('rejects non-numeric values', () => {
    expect(moneyStringSchema.safeParse('abc').success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'Teacher@Example.COM',
      password: 'supersecret',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Email is normalized to lowercase.
      expect(result.data.email).toBe('teacher@example.com')
    }
  })

  it('rejects short passwords and bad emails', () => {
    expect(
      loginSchema.safeParse({ email: 'bad', password: 'short' }).success,
    ).toBe(false)
  })
})

describe('paginationQuerySchema', () => {
  it('coerces string query params and applies defaults', () => {
    const result = paginationQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(20)
    const parsed = paginationQuerySchema.parse({ page: '3', perPage: '50' })
    expect(parsed.page).toBe(3)
    expect(parsed.perPage).toBe(50)
  })

  it('rejects out-of-range perPage', () => {
    expect(paginationQuerySchema.safeParse({ perPage: 500 }).success).toBe(
      false,
    )
  })
})

describe('academicSessionSchema', () => {
  it('rejects an end date before the start date', () => {
    expect(
      academicSessionSchema.safeParse({
        name: '2025/2026',
        shortName: '2526',
        startDate: '2025-09-01',
        endDate: '2025-06-01',
      }).success,
    ).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('requires matching passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        token: 't',
        email: 'a@b.com',
        password: 'password123',
        passwordConfirmation: 'different',
      }).success,
    ).toBe(false)
  })
})
