/** GET /api/v1/assignments/:id/attachments/:attachmentId (download) */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import {
  getActor,
  getAttachmentForActor,
} from '~/server/services/assignments'
import { streamObject } from '~/server/utils/storage'

const paramsSchema = z.object({ id: uuidSchema, attachmentId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.view')
  const { id, attachmentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    attachmentId: getRouterParam(event, 'attachmentId'),
  })
  const actor = await getActor(auth)
  const access = await getAttachmentForActor(id, attachmentId, actor)
  return streamObject(
    event,
    access.objectKey,
    access.attachment.fileName,
    access.attachment.mimeType,
  )
})
