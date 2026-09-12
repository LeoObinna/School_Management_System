/** GET /api/v1/assignments/:id/submission/download (own file) */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  getMySubmissionFile,
} from '~/server/services/assignments'
import { streamObject } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'submissions.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth)
  const file = await getMySubmissionFile(id, actor)
  return streamObject(event, file.objectKey, file.fileName!, file.mimeType)
})
