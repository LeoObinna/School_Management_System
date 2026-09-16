import { describe, expect, it } from 'vitest'
import {
  AUDIT_LOG_RESOURCES,
  attendanceOverviewReportQuerySchema,
  auditLogListQuerySchema,
  enrollmentReportQuerySchema,
  overviewQuerySchema,
} from '../schemas/reports'

const UUID = '11111111-1111-1111-1111-111111111111'

describe('reports schemas', () => {
  describe('overviewQuerySchema', () => {
    it('accepts empty object', () => {
      expect(overviewQuerySchema.parse({})).toEqual({})
    })

    it('accepts optional session/term UUIDs', () => {
      const out = overviewQuerySchema.parse({
        sessionId: UUID,
        termId: UUID,
      })
      expect(out).toEqual({ sessionId: UUID, termId: UUID })
    })

    it('rejects non-UUID session id', () => {
      expect(() => overviewQuerySchema.parse({ sessionId: 'nope' })).toThrow()
    })
  })

  describe('attendanceOverviewReportQuerySchema', () => {
    it('accepts optional scope filters', () => {
      const out = attendanceOverviewReportQuerySchema.parse({
        sessionId: UUID,
        termId: UUID,
        classId: UUID,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      })
      expect(out).toMatchObject({ dateFrom: '2026-09-01' })
    })

    it('rejects malformed date', () => {
      expect(() =>
        attendanceOverviewReportQuerySchema.parse({ dateFrom: '2026/09/01' }),
      ).toThrow()
    })
  })

  describe('enrollmentReportQuerySchema', () => {
    it('accepts a valid status enum value', () => {
      expect(
        enrollmentReportQuerySchema.parse({ status: 'active' }).status,
      ).toBe('active')
    })

    it('rejects an unknown status', () => {
      expect(() =>
        enrollmentReportQuerySchema.parse({ status: 'suspended' }),
      ).toThrow()
    })
  })

  describe('auditLogListQuerySchema', () => {
    it('applies pagination defaults', () => {
      const out = auditLogListQuerySchema.parse({})
      expect(out.page).toBe(1)
      expect(out.perPage).toBe(20)
      expect(out.order).toBe('asc')
    })

    it('accepts all filter params', () => {
      const out = auditLogListQuerySchema.parse({
        action: 'student.create',
        resource: 'student',
        userId: UUID,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        search: 'amara',
        page: 2,
        perPage: 10,
      })
      expect(out.action).toBe('student.create')
      expect(out.userId).toBe(UUID)
      expect(out.page).toBe(2)
    })

    it('rejects non-UUID userId', () => {
      expect(() =>
        auditLogListQuerySchema.parse({ userId: 'nope' }),
      ).toThrow()
    })
  })

  describe('AUDIT_LOG_RESOURCES', () => {
    it('is a non-empty tuple', () => {
      expect(AUDIT_LOG_RESOURCES.length).toBeGreaterThan(10)
    })

    it('includes common resources used by writeAudit call sites', () => {
      expect(AUDIT_LOG_RESOURCES).toContain('auth')
      expect(AUDIT_LOG_RESOURCES).toContain('student')
      expect(AUDIT_LOG_RESOURCES).toContain('announcement')
      expect(AUDIT_LOG_RESOURCES).toContain('attendance_session')
      expect(AUDIT_LOG_RESOURCES).toContain('invoice')
    })

    it('has no duplicates', () => {
      expect(new Set(AUDIT_LOG_RESOURCES).size).toBe(
        AUDIT_LOG_RESOURCES.length,
      )
    })
  })
})
