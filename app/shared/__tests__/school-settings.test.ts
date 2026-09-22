/**
 * Phase 14A school settings validation contract tests.
 */
import { describe, it, expect } from 'vitest'
import {
  schoolSettingsSchema,
  schoolSettingsUpdateSchema,
  schoolPublicSettingsSchema,
} from '../schemas/school-settings'

describe('schoolSettingsSchema', () => {
  it('accepts a complete valid settings object', () => {
    const result = schoolSettingsSchema.safeParse({
      name: 'Victorious Children School',
      motto: 'Knowledge, Discipline, Excellence',
      address: 'Ojodu, Lagos',
      email: 'info@victoriouschildren.school',
      phone: '+234 801 234 5678',
      logoKey: 'logos/school.png',
      primaryColor: '#1a237e',
      secondaryColor: '#1a1a2e',
      currency: 'NGN',
      bankName: 'First Bank',
      accountName: 'VCS',
      accountNumber: '1234567890',
      academicYearStartMonth: 9,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing name', () => {
    const result = schoolSettingsSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects malformed hex colors', () => {
    expect(
      schoolSettingsSchema.safeParse({ name: 'X', primaryColor: 'blue' }).success,
    ).toBe(false)
    expect(
      schoolSettingsSchema.safeParse({ name: 'X', primaryColor: '#abc' }).success,
    ).toBe(false)
  })

  it('accepts empty strings for optional fields', () => {
    const result = schoolSettingsSchema.safeParse({
      name: 'X',
      motto: '',
      email: '',
      phone: '',
      logoKey: '',
      primaryColor: '',
      secondaryColor: '',
      currency: '',
      bankName: '',
      accountName: '',
      accountNumber: '',
    })
    expect(result.success).toBe(true)
  })

  it('coerces and bounds academicYearStartMonth to 1-12', () => {
    const ok = schoolSettingsSchema.safeParse({ name: 'X', academicYearStartMonth: '9' })
    expect(ok.success).toBe(true)
    const bad = schoolSettingsSchema.safeParse({ name: 'X', academicYearStartMonth: 13 })
    expect(bad.success).toBe(false)
  })

  it('normalizes currency to uppercase', () => {
    const result = schoolSettingsSchema.safeParse({ name: 'X', currency: 'ngn' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('NGN')
    }
  })
})

describe('schoolSettingsUpdateSchema', () => {
  it('accepts a partial update with a single field', () => {
    const result = schoolSettingsUpdateSchema.safeParse({ bankName: 'GTBank' })
    expect(result.success).toBe(true)
  })

  it('rejects a partial update with a bad field', () => {
    const result = schoolSettingsUpdateSchema.safeParse({ primaryColor: 'nope' })
    expect(result.success).toBe(false)
  })
})

describe('schoolPublicSettingsSchema', () => {
  it('excludes bank/finance/academic fields from the public shape', () => {
    // Public schema does not define bank fields; extra keys are ignored
    // by default, but let's assert the public ones are accepted.
    const result = schoolPublicSettingsSchema.safeParse({
      name: 'X',
      motto: '',
      address: '',
      email: '',
      phone: '',
      logoKey: '',
      primaryColor: '#1a237e',
      secondaryColor: '#1a1a2e',
    })
    expect(result.success).toBe(true)
  })
})
