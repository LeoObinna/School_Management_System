/**
 * GET /api/v1/gallery/albums/:id/images/:imageId/thumbnail
 *
 * Streams the derived JPEG thumbnail (Phase 12 Part C / Option C).
 * Requires the same `gallery.view` permission as the full image.
 *
 * Backfill: rows created before thumbnailing (or whose eager
 * generation failed) have a null `thumb_object_key`; the first
 * authorized view generates the thumb from the original R2 object and
 * persists it. If the source is unsupported (GIF/SVG), too small, or
 * its bytes are missing, the route responds 404 and the UI falls back
 * to the original image URL.
 *
 * Thumbnails are immutable per image id (images are never mutated), so
 * successful responses are cacheable for a year by authorized clients.
 */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getImageForDownload } from '~/server/services/events'
import { streamObject } from '~/server/utils/storage'
import { smsNotFound } from '~/server/utils/http-errors'
import {
  THUMBNAIL_MIME,
  thumbObjectKeyFor,
} from '~/server/utils/images/thumbnail'
import { createAndStoreThumbnail } from '~/server/utils/images/gallery-thumbnails'

const paramsSchema = idParamSchema.extend({
  imageId: idParamSchema.shape.id,
})

const THUMB_CACHE_CONTROL = 'private, max-age=31536000, immutable'

function thumbDownloadName(fileName: string): string {
  return `${fileName.replace(/\.[^.]+$/, '') || 'image'}.thumb.jpg`
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'gallery.view')
  const { id, imageId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    imageId: getRouterParam(event, 'imageId'),
  })
  const image = await getImageForDownload(id, imageId)

  let thumbKey = image.thumbObjectKey
  if (!thumbKey) {
    // Lazy one-time backfill for pre-Option-C images / failed eager gen.
    thumbKey = await createAndStoreThumbnail(event, image)
    if (!thumbKey) {
      throw smsNotFound('No thumbnail is available for this image.')
    }
  }

  try {
    return await streamObject(
      event,
      thumbKey,
      thumbDownloadName(image.fileName),
      THUMBNAIL_MIME,
      { disposition: 'inline', cacheControl: THUMB_CACHE_CONTROL },
    )
  } catch (e) {
    // Row advertises a thumb whose R2 object is missing — regenerate
    // once from the original at the deterministic key.
    if ((e as { statusCode?: number }).statusCode !== 404) throw e
    const regenerated = await createAndStoreThumbnail(event, {
      ...image,
      thumbObjectKey: thumbObjectKeyFor(image.objectKey),
    })
    if (!regenerated) {
      throw smsNotFound('No thumbnail is available for this image.')
    }
    return streamObject(
      event,
      regenerated,
      thumbDownloadName(image.fileName),
      THUMBNAIL_MIME,
      { disposition: 'inline', cacheControl: THUMB_CACHE_CONTROL },
    )
  }
})
