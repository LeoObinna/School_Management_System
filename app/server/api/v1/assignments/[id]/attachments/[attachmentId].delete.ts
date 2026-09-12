/** DELETE /api/v1/assignments/:id/attachments/:attachmentId */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import {
  deleteAttachment,
  getActor,
} from '~/server/services/assignments'
import {
  deleteObject,
  getR2Bucket,
} from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema, attachmentId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.update')
  const { id, attachmentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    attachmentId: getRouterParam(event, 'attachmentId'),
  })
  const actor = await getActor(auth)
  getR2Bucket(event)
  const objectKey = await deleteAttachment(id, attachmentId, actor)
  await deleteObject(event, objectKey)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'assignment.attachment.delete',
    resource: 'assignment_attachment',
    resourceId: attachmentId,
    description: `Deleted attachment from assignment ${id}.`,
  })
  return { ok: true }
})
