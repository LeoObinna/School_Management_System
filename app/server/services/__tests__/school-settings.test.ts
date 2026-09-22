/**
 * Phase 14A school settings service tests.
 *
 * The DB layer is mocked so we assert key/value mapping, defaults,
 * coercion and the public subset without a live Postgres.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let storedRows: { key: string; value: string | null }[] = []
const inserted: { key: string; value: string }[] = []
const updated: { key: string; value: string }[] = []

vi.mock('../../utils/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => Promise.resolve(storedRows)),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockImplementation(({ target, set }: { target: unknown; set: { value: string } }) => {
      // Simulate upsert: if key exists, update value; else insert.
      // We capture insert values separately because mockReturnThis chains.
      return Promise.resolve([{ id: 'x' }])
    }),
  },
}))

// The db.insert(...).values(...) chain needs to capture the values. Patch
// the chain methods to record arguments.
const dbMod = await import('../../utils/db')
vi.spyOn(dbMod.db, 'insert').mockImplementation((() => {
  const chain = {
    values: (v: { key: string; value: string }) => {
      inserted.push(v)
      return {
        onConflictDoUpdate: ({ set }: { set: { value: string } }) => {
          updated.push({ key: v.key, value: set.value })
          return Promise.resolve([{ id: 'x' }])
        },
      }
    },
  }
  return chain as unknown as ReturnType<typeof dbMod.db.insert>
}) as typeof dbMod.db.insert)

import { getSchoolSettings, updateSchoolSettings, getPublicSchoolSettings } from '../school-settings'

describe('school settings service', () => {
  beforeEach(() => {
    storedRows = []
    inserted.length = 0
    updated.length = 0
  })

  it('returns defaults when no rows exist', async () => {
    storedRows = []
    const settings = await getSchoolSettings()
    expect(settings.name).toBe('Victorious Children School')
    expect(settings.primaryColor).toBe('#1a237e')
    expect(settings.currency).toBe('NGN')
    expect(settings.academicYearStartMonth).toBe(9)
  })

  it('merges stored values into the typed object', async () => {
    storedRows = [
      { key: 'school.name', value: 'Renamed School' },
      { key: 'school.academic_year_start_month', value: '1' },
      { key: 'school.bank_name', value: 'GTBank' },
    ]
    const settings = await getSchoolSettings()
    expect(settings.name).toBe('Renamed School')
    expect(settings.academicYearStartMonth).toBe(1)
    expect(settings.bankName).toBe('GTBank')
    // Unset keys fall back to defaults.
    expect(settings.motto).toBe('')
  })

  it('coerces an out-of-range month to null', async () => {
    storedRows = [
      { key: 'school.academic_year_start_month', value: '99' },
    ]
    const settings = await getSchoolSettings()
    expect(settings.academicYearStartMonth).toBeNull()
  })

  it('upserts only the patched fields', async () => {
    storedRows = [{ key: 'school.name', value: 'Old' }]
    await updateSchoolSettings({ bankName: 'First Bank', currency: 'USD' })
    const keys = inserted.map((r) => r.key)
    expect(keys).toContain('school.bank_name')
    expect(keys).toContain('school.currency')
    expect(keys).not.toContain('school.name')
    expect(updated.find((u) => u.key === 'school.bank_name')?.value).toBe('First Bank')
    expect(updated.find((u) => u.key === 'school.currency')?.value).toBe('USD')
  })

  it('stores an empty string for a cleared field', async () => {
    await updateSchoolSettings({ motto: null })
    const row = inserted.find((r) => r.key === 'school.motto')
    expect(row?.value).toBe('')
  })

  it('public subset excludes bank/finance/academic fields', async () => {
    storedRows = [
      { key: 'school.name', value: 'Public' },
      { key: 'school.bank_name', value: 'Secret' },
      { key: 'school.academic_year_start_month', value: '9' },
    ]
    const pub = await getPublicSchoolSettings()
    expect(pub.name).toBe('Public')
    expect(pub).not.toHaveProperty('bankName')
    expect(pub).not.toHaveProperty('academicYearStartMonth')
  })
})
