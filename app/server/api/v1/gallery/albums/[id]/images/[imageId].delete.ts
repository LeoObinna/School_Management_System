/** DELETE /api/v1/gallery/albums/:id/images/:imageId */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteImage } from '~/server/services/events'
import { deleteObject } from '~/server/utils/storage'
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
  for (const key of [objectKey, thumbObjectKey]) {
    if (!key) continue
    try {
      await deleteObject(event, key)
    } catch {
      // R2 may be unavailable in plain Node dev (503); ignore.
    }
  }
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'gallery.image.delete',
    resource: 'gallery_image',
    resourceId: imageId,
    description: `Deleted image from album "${detail.title}".`,
  })
  return detail
})
