/**
 * Student self-service validation schemas (README §17, Phase 8).
 *
 * The student self-service endpoints (/students/me, /students/me/timetable,
 * /students/me/results) read the caller's studentId server-side via
 * resolveActorBusinessIds; their query schemas therefore only carry
 * filters the student is allowed to narrow further (sessionId, termId,
 * weekday) and never accept a studentId parameter.
 */
import { z } from 'zod'
import { uuidSchema } from './common'
import { WEEKDAYS } from './schedule'

/**
 * Filters for GET /api/v1/students/me/timetable. A student may narrow to
 * one weekday or one session; everything else (the class list) is
 * resolved from their active enrollments inside the service.
 */
export const myTimetableQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  weekday: z.enum(WEEKDAYS).optional(),
})

export type MyTimetableQuery = z.infer<typeof myTimetableQuerySchema>

/**
 * Filters for GET /api/v1/students/me/results. Both sessionId and termId
 * are required: result publication status is per session+term+class, so a
 * "current term" default would silently hide results the student expects
 * to see. The route surfaces this as a 400 instead of guessing.
 */
export const myResultsQuerySchema = z.object({
  sessionId: uuidSchema,
  termId: uuidSchema,
})

export type MyResultsQuery = z.infer<typeof myResultsQuerySchema>
