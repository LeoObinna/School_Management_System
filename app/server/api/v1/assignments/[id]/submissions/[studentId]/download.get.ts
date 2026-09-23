/** GET /api/v1/assignments/:id/submissions/:studentId/download */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { getStudentSubmissionFile } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { streamObject } from '~/server/utils/storage'

const paramsSchema = z.object({ id: uuidSchema, studentId: uuidSchema })

export default defineEventHandler(async (event) => {
  requirePermission(event, 'submissions.view')
  const { id, studentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    studentId: getRouterParam(event, 'studentId'),
  })
  const actor = await resolveActorProfile(event, 'assignments.create')
  const file = await getStudentSubmissionFile(id, studentId, actor)
  return streamObject(event, file.objectKey, file.fileName!, file.mimeType)
})
