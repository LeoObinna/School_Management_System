/**
 * GET /api/v1/public/gallery/images/:imageId?variant=full|thumb
 *
 * Public image streaming (Phase 18B). The image is served only when its
 * parent album is published — anything else is a generic 404, so
 * unpublished content and unknown ids are indistinguishable. Object keys
 * are never exposed; the image id in the URL is an unguessable UUID.
 *
 * `variant=thumb` serves the derived JPEG thumbnail, lazily generating it
 * on first view (same backfill as the authenticated thumbnail route).
 * When no thumbnail exists or can be generated (GIF/SVG/too small), the
 * route falls back to the full image so grid <img> tags always render.
 *
 * Responses are publicly cacheable at the edge for a day.
 */
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import { idParamSchema, publicImageQuerySchema } from '~/shared/schemas'
import { getPublicImageForStream } from '~/server/services/public'
import { streamObject } from '~/server/utils/storage'
import {
  THUMBNAIL_MIME,
  thumbObjectKeyFor,
} from '~/server/utils/images/thumbnail'
import { createAndStoreThumbnail } from '~/server/utils/images/gallery-thumbnails'

const IMAGE_CACHE_CONTROL =
  'public, max-age=86400, stale-while-revalidate=604800'

function thumbDownloadName(fileName: string): string {
  return `${fileName.replace(/\.[^.]+$/, '') || 'image'}.thumb.jpg`
}

export default defineEventHandler(async (event) => {
  const { id: imageId } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'imageId'),
  })
  const { variant } = parseQueryData(publicImageQuerySchema, getQuery(event))
  const image = await getPublicImageForStream(imageId)

  if (variant === 'thumb') {
    let thumbKey = image.thumbObjectKey
    if (!thumbKey) {
      thumbKey = await createAndStoreThumbnail(event, image)
    }
    if (thumbKey) {
      try {
        return await streamObject(
          event,
          thumbKey,
          thumbDownloadName(image.fileName),
          THUMBNAIL_MIME,
          { disposition: 'inline', cacheControl: IMAGE_CACHE_CONTROL },
        )
      } catch (e) {
        // Advertised thumb whose R2 object is missing — one regenerate
        // attempt, then fall through to the full image.
        if ((e as { statusCode?: number }).statusCode !== 404) throw e
        const regenerated = await createAndStoreThumbnail(event, {
          ...image,
          thumbObjectKey: thumbObjectKeyFor(image.objectKey),
        })
        if (regenerated) {
          return await streamObject(
            event,
            regenerated,
            thumbDownloadName(image.fileName),
            THUMBNAIL_MIME,
            { disposition: 'inline', cacheControl: IMAGE_CACHE_CONTROL },
          )
        }
      }
    }
    // No thumbnail available — fall through to the full image.
  }

  return streamObject(event, image.objectKey, image.fileName, image.mimeType, {
    disposition: 'inline',
    cacheControl: IMAGE_CACHE_CONTROL,
  })
})
