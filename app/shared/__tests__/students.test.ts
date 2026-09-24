/**
 * Phase 8 validation contract tests: student self-service query schemas.
 * These endpoints never accept a studentId from the client (the actor
 * resolver fills it server-side), so the schemas only validate the
 * optional filters the student is allowed to narrow further.
 */
import { describe, it, expect } from 'vitest'
import {
  myResultsQuerySchema,
  myTimetableQuerySchema,
} from '../schemas/students'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('myTimetableQuerySchema', () => {
  it('accepts an empty query and returns all-undefined filters', () => {
    const parsed = myTimetableQuerySchema.parse({})
    expect(parsed.sessionId).toBeUndefined()
    expect(parsed.weekday).toBeUndefined()
  })

  it('accepts a valid sessionId and weekday', () => {
    const parsed = myTimetableQuerySchema.parse({
      sessionId: UUID,
      weekday: 'monday',
    })
    expect(parsed.sessionId).toBe(UUID)
    expect(parsed.weekday).toBe('monday')
  })

  it('rejects a non-UUID sessionId', () => {
    expect(
      myTimetableQuerySchema.safeParse({ sessionId: 'not-a-uuid' }).success,
    ).toBe(false)
  })

  it('rejects an unknown weekday', () => {
    expect(
      myTimetableQuerySchema.safeParse({ weekday: 'funday' }).success,
    ).toBe(false)
  })

  it('strips unknown keys (a client cannot smuggle in a studentId)', () => {
    const parsed = myTimetableQuerySchema.parse({
      weekday: 'tuesday',
      studentId: UUID, // must be dropped — studentId is server-resolved
    })
    expect((parsed as Record<string, unknown>).studentId).toBeUndefined()
  })
})

describe('myResultsQuerySchema', () => {
  it('accepts a valid sessionId + termId pair', () => {
    const parsed = myResultsQuerySchema.parse({
      sessionId: UUID,
      termId: UUID,
    })
    expect(parsed.sessionId).toBe(UUID)
    expect(parsed.termId).toBe(UUID)
  })

  it('rejects when sessionId is missing (no silent "current session" default)', () => {
    expect(myResultsQuerySchema.safeParse({ termId: UUID }).success).toBe(false)
  })

  it('rejects when termId is missing', () => {
    expect(myResultsQuerySchema.safeParse({ sessionId: UUID }).success).toBe(
      false,
    )
  })

  it('rejects non-UUID values', () => {
    expect(
      myResultsQuerySchema.safeParse({
        sessionId: 'not-a-uuid',
        termId: UUID,
      }).success,
    ).toBe(false)
    expect(
      myResultsQuerySchema.safeParse({
        sessionId: UUID,
        termId: 'not-a-uuid',
      }).success,
    ).toBe(false)
  })
})
