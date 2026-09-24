/**
 * Phase 9 validation contract tests: parent self-service query schemas.
 * The parent self-service endpoints read the caller's parentId and child
 * list server-side via resolveActorBusinessIds; the child-specific
 * routes take a studentId from the path (re-verified in the service),
 * and the query schemas only validate the filters a parent may narrow
 * further (sessionId, termId).
 */
import { describe, it, expect } from 'vitest'
import { myChildResultsQuerySchema } from '../schemas/parents'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('myChildResultsQuerySchema', () => {
  it('accepts a valid sessionId + termId pair', () => {
    const parsed = myChildResultsQuerySchema.parse({
      sessionId: UUID,
      termId: UUID,
    })
    expect(parsed.sessionId).toBe(UUID)
    expect(parsed.termId).toBe(UUID)
  })

  it('rejects when sessionId is missing (no silent "current session" default)', () => {
    expect(
      myChildResultsQuerySchema.safeParse({ termId: UUID }).success,
    ).toBe(false)
  })

  it('rejects when termId is missing', () => {
    expect(
      myChildResultsQuerySchema.safeParse({ sessionId: UUID }).success,
    ).toBe(false)
  })

  it('rejects non-UUID values', () => {
    expect(
      myChildResultsQuerySchema.safeParse({
        sessionId: 'not-a-uuid',
        termId: UUID,
      }).success,
    ).toBe(false)
    expect(
      myChildResultsQuerySchema.safeParse({
        sessionId: UUID,
        termId: 'not-a-uuid',
      }).success,
    ).toBe(false)
  })

  it('strips unknown keys (a client cannot smuggle in a parentId or studentId)', () => {
    const parsed = myChildResultsQuerySchema.parse({
      sessionId: UUID,
      termId: UUID,
      parentId: UUID, // must be dropped — parentId is server-resolved
      studentId: UUID, // must be dropped — taken from the path & re-verified
    }) as Record<string, unknown>
    expect(parsed.parentId).toBeUndefined()
    expect(parsed.studentId).toBeUndefined()
  })
})
