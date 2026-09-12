/** POST /api/v1/assignments/:id/attachments  (multipart) */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  addAttachment,
  getActor,
} from '~/server/services/assignments'
import { readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'assignments.update')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth)
  const { file, meta } = await readUpload(event, 'assignment_attachment')

  const objectKey = buildObjectKey(
    'assignments/attachments',
    [id],
    meta.fileName,
    crypto.randomUUID(),
  )
  await putObject(event, objectKey, await file.arrayBuffer(), meta.mimeType)

  try {
    const attachment = await addAttachment(
      id,
      {
        objectKey,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      },
      actor,
    )
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'assignment.attachment.upload',
      resource: 'assignment_attachment',
      resourceId: attachment.id,
      description: `Uploaded "${attachment.fileName}" to assignment ${id}.`,
    })
    setResponseStatus(event, 201)
    return attachment
  } catch (e) {
    // Avoid orphan bytes when the metadata write fails.
    await deleteObject(event, objectKey)
    throw e
  }
})
