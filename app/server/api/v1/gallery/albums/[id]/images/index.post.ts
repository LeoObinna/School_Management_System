/** POST /api/v1/gallery/albums/:id/images  (multipart) */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { galleryImageCaptionSchema, idParamSchema } from '~/shared/schemas'
import { addImage } from '~/server/services/events'
import { formString, readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObjects,
  putObject,
} from '~/server/utils/storage'
import {
  generateThumbnail,
  isThumbnailable,
  THUMBNAIL_MIME,
  thumbObjectKeyFor,
} from '~/server/utils/images/thumbnail'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'gallery.manage')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const { form, file, meta } = await readUpload(event, 'gallery_image')

  const captionParsed = galleryImageCaptionSchema.safeParse(
    formString(form, 'caption'),
  )
  const caption = captionParsed.success ? captionParsed.data : null

  const objectKey = buildObjectKey(
    'gallery/albums',
    [id],
    meta.fileName,
    crypto.randomUUID(),
  )
  const originalBytes = new Uint8Array(await file.arrayBuffer())
  await putObject(event, objectKey, originalBytes, meta.mimeType)

  // Best-effort derived thumbnail. Never blocks the upload; a null
  // result leaves thumb_object_key null and the GET route backfills or
  // the UI falls back to the original image.
  let thumbObjectKey: string | null = null
  if (isThumbnailable(meta.mimeType)) {
    try {
      const thumbnail = await generateThumbnail(originalBytes, meta.mimeType)
      if (thumbnail) {
        thumbObjectKey = thumbObjectKeyFor(objectKey)
        await putObject(event, thumbObjectKey, thumbnail.bytes, THUMBNAIL_MIME)
      }
    } catch {
      thumbObjectKey = null
    }
  }

  const storedKeys = [objectKey]
  if (thumbObjectKey) storedKeys.push(thumbObjectKey)

  try {
    const album = await addImage(id, {
      objectKey,
      thumbObjectKey,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      caption,
    })
    const stored = album.images.find((img) => img.objectKey === objectKey)
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'gallery.image.upload',
      resource: 'gallery_image',
      resourceId: stored?.id ?? id,
      description: `Uploaded "${meta.fileName}" to album "${album.title}".`,
    })
    setResponseStatus(event, 201)
    return album
  } catch (e) {
    // Avoid orphan bytes if the metadata update failed.
    await deleteObjects(event, storedKeys).catch(() => {})
    throw e
  }
})
