/** POST /api/v1/gallery/albums/:id/images  (multipart) */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { galleryImageCaptionSchema, idParamSchema } from '~/shared/schemas'
import { addImage } from '~/server/services/events'
import { formString, readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { smsFieldError } from '~/server/utils/http-errors'
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
  await putObject(event, objectKey, await file.arrayBuffer(), meta.mimeType)

  try {
    const album = await addImage(id, {
      objectKey,
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
    await deleteObject(event, objectKey)
    throw e
  }
})
