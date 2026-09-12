/** POST /api/v1/resources  (multipart: metadata fields + file) */
import { defineEventHandler, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { resourceCreateSchema } from '~/shared/schemas'
import { getActor } from '~/server/services/assignments'
import { createResource } from '~/server/services/resources'
import { formString, readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { smsFieldError } from '~/server/utils/http-errors'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'resources.manage')
  const actor = await getActor(auth, 'resources.manage')
  const { file, meta, form } = await readUpload(event, 'resource')

  const title = formString(form, 'title')
  if (!title) {
    throw smsFieldError('title', 'Title is required.')
  }
  const classId = formString(form, 'classId') || null
  const subjectId = formString(form, 'subjectId') || null
  const description = formString(form, 'description') ?? null
  const isPublished = formString(form, 'isPublished') !== 'false'

  const objectKey = buildObjectKey(
    'resources',
    [classId ?? 'school-wide'],
    meta.fileName,
    crypto.randomUUID(),
  )

  const data = parseBody(resourceCreateSchema, {
    title,
    description,
    classId,
    subjectId,
    isPublished,
    objectKey,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
  })

  await putObject(event, objectKey, await file.arrayBuffer(), meta.mimeType)
  try {
    const resource = await createResource(data, actor)
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'resource.upload',
      resource: 'learning_resource',
      resourceId: resource.id,
      description: `Uploaded resource "${resource.title}" (${resource.fileName}).`,
    })
    setResponseStatus(event, 201)
    return resource
  } catch (e) {
    await deleteObject(event, objectKey)
    throw e
  }
})
