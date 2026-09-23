/**
 * Teacher self-service validation schemas (README §17, Phase 7).
 *
 * The teacher self-service endpoints (/teachers/me, /teacher-assignments/me,
 * /teachers/me/students, /teachers/me/to-grade) read the caller's teacherId
 * server-side via resolveActorBusinessIds; their query schemas therefore
 * only carry filters the teacher is allowed to narrow further (classId,
 * sessionId, status) and never accept a teacherId parameter.
 */
import { z } from 'zod'
import { paginationQuerySchema, uuidSchema } from './common'
import { SUBMISSION_STATUSES } from './assignments'

/**
 * Filters for GET /api/v1/teachers/me/students. The classId, when supplied,
 * must be one of the caller's assigned classes (enforced in the service).
 */
export const myStudentListQuerySchema = paginationQuerySchema.extend({
  classId: uuidSchema.optional(),
  search: z.string().trim().max(255).optional(),
})

export type MyStudentListQuery = z.infer<typeof myStudentListQuerySchema>

/**
 * Filters for GET /api/v1/teachers/me/to-grade. Status defaults to
 * 'submitted' at the route layer; teachers may also see 'late' work.
 */
export const submissionsToGradeQuerySchema = paginationQuerySchema.extend({
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
})

export type SubmissionsToGradeQuery = z.infer<
  typeof submissionsToGradeQuerySchema
>
