/**
 * Parent self-service validation schemas (README §17, Phase 9).
 *
 * The parent self-service endpoints read the caller's parentId and
 * child list server-side via resolveActorBusinessIds; their query
 * schemas therefore only carry filters the parent is allowed to narrow
 * further (sessionId, termId) and never accept a parentId or studentId
 * parameter. The child-specific routes take a studentId from the path,
 * but the service re-verifies it against the actor's children before
 * returning any data.
 */
import { z } from 'zod'
import { uuidSchema } from './common'

/**
 * Filters for GET /api/v1/parents/me/children/:studentId/results.
 * Both sessionId and termId are required: publication status is per
 * session+term+class, so a "current term" default would silently hide
 * results the parent expects to see. The route surfaces this as a 422
 * instead of guessing.
 */
export const myChildResultsQuerySchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema,
})

export type MyChildResultsQuery = z.infer<typeof myChildResultsQuerySchema>
