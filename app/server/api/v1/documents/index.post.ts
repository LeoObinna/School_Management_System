/** POST /api/v1/documents  (multipart: metadata fields + file) */
import { defineEventHandler, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { documentCreateSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { createDocument } from '~/server/services/documents'
import { formString, readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { smsFieldError } from '~/server/utils/http-errors'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'documents.manage')
  const actor = await resolveActorProfile(event, 'documents.manage')
  const { file, meta, form } = await readUpload(event, 'school_document')

  const title = formString(form, 'title')
  if (!title) {
    throw smsFieldError('title', 'Title is required.')
  }
  const description = formString(form, 'description') ?? null
  const category = formString(form, 'category') ?? null
  const visibility = (formString(form, 'visibility') as 'staff' | 'admin') || 'staff'
  const ownerType = (formString(form, 'ownerType') as 'school' | 'staff') || 'school'
  const ownerId = formString(form, 'ownerId') || null

  const objectKey = buildObjectKey(
    'documents',
    [ownerType, ownerId ?? 'school'],
    meta.fileName,
    crypto.randomUUID(),
  )

  const data = parseBody(documentCreateSchema, {
    title,
    description,
    category,
    visibility,
    ownerType,
    ownerId,
    objectKey,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
  })

  await putObject(event, objectKey, await file.arrayBuffer(), meta.mimeType)
  try {
    const document = await createDocument(data, actor)
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'document.upload',
      resource: 'document',
      resourceId: document.id,
      description: `Uploaded document "${document.title}" (${document.fileName}).`,
    })
    setResponseStatus(event, 201)
    return document
  } catch (e) {
    await deleteObject(event, objectKey)
    throw e
  }
})
