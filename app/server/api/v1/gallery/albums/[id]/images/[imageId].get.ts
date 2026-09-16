/** GET /api/v1/gallery/albums/:id/images/:imageId */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getImageForDownload } from '~/server/services/events'
import { streamObject } from '~/server/utils/storage'

const paramsSchema = idParamSchema.extend({
  imageId: idParamSchema.shape.id,
})

export default defineEventHandler(async (event) => {
  requirePermission(event, 'gallery.view')
  const { id, imageId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    imageId: getRouterParam(event, 'imageId'),
  })
  const image = await getImageForDownload(id, imageId)
  return streamObject(event, image.objectKey, image.fileName, image.mimeType)
})
