/** DELETE /api/v1/gallery/albums/:id/images/:imageId */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteImage } from '~/server/services/events'
import { deleteObjects } from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = idParamSchema.extend({
  imageId: idParamSchema.shape.id,
})

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'gallery.manage')
  const { id, imageId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    imageId: getRouterParam(event, 'imageId'),
  })
  const { detail, objectKey, thumbObjectKey } = await deleteImage(id, imageId)
  // Best-effort R2 cleanup; failures do not break the request (R2 may be
  // unavailable in plain Node dev — 503 is swallowed).
  const keys = [objectKey, thumbObjectKey].filter(
    (k): k is string => Boolean(k),
  )
  await deleteObjects(event, keys).catch(() => {})
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'gallery.image.delete',
    resource: 'gallery_image',
    resourceId: imageId,
    description: `Deleted image from album "${detail.title}".`,
  })
  return detail
})
