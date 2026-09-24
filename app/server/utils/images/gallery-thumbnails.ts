/**
 * Gallery thumbnail persistence (Phase 12 Part C / Option C).
 *
 * A thumbnail is a derived JPEG cache: the original R2 object is the
 * source of truth; the thumb object (key derived deterministically,
 * `thumb_object_key` in D1) may be missing or regenerated at
 * any time. All failures here are swallowed by design — thumbnailing
 * must never block an upload or an image view; the UI falls back to
 * the original bytes.
 */
import type { H3Event } from 'h3'
import type { GalleryImage } from '~/shared/types'
import {
  getObjectBytes,
  putObject,
} from '~/server/utils/storage'
import { setImageThumbObjectKey } from '~/server/services/events'
import {
  generateThumbnail,
  THUMBNAIL_MIME,
  thumbObjectKeyFor,
} from './thumbnail'

/**
 * Generates (if possible) and stores a thumbnail for an already-stored
 * image, recording its key on the image row. Returns the stored key, or
 * null when no thumbnail could be produced. Never throws.
 */
export async function createAndStoreThumbnail(
  event: H3Event,
  image: Pick<GalleryImage, 'id' | 'objectKey' | 'thumbObjectKey' | 'mimeType'>,
  sourceBytes?: Uint8Array,
): Promise<string | null> {
  try {
    const bytes = sourceBytes
      ?? (await getObjectBytes(event, image.objectKey))
    if (!bytes) return null
    const thumbnail = await generateThumbnail(bytes, image.mimeType)
    if (!thumbnail) return null

    const thumbKey = image.thumbObjectKey ?? thumbObjectKeyFor(image.objectKey)
    await putObject(event, thumbKey, thumbnail.bytes, THUMBNAIL_MIME)
    await setImageThumbObjectKey(image.id, thumbKey)
    return thumbKey
  } catch {
    return null
  }
}
