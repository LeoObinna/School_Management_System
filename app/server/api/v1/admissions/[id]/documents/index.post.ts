/** POST /api/v1/admissions/:id/documents  (multipart) */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import {
  documentTypeSchema,
  idParamSchema,
} from '~/shared/schemas'
import { addDocument } from '~/server/services/admissions'
import { formString, readUpload } from '~/server/utils/multipart'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { smsFieldError } from '~/server/utils/http-errors'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.documents.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const { form, file, meta } = await readUpload(
    event,
    'admission_document',
  )

  const parsedType = documentTypeSchema.safeParse(
    formString(form, 'documentType'),
  )
  if (!parsedType.success) {
    throw smsFieldError('documentType', 'Document type is required.')
  }

  const objectKey = buildObjectKey(
    'admissions/documents',
    [id],
    meta.fileName,
    crypto.randomUUID(),
  )
  await putObject(event, objectKey, await file.arrayBuffer(), meta.mimeType)

  try {
    const application = await addDocument(id, {
      documentType: parsedType.data,
      objectKey,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
    })
    const stored = application.documents.find(
      (d) => d.objectKey === objectKey,
    )
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'admission.document.upload',
      resource: 'admission_document',
      resourceId: stored?.id ?? id,
      description: `Uploaded "${meta.fileName}" to application ${application.applicationNumber}.`,
    })
    setResponseStatus(event, 201)
    return application
  } catch (e) {
    // Avoid orphan bytes when the metadata write fails.
    await deleteObject(event, objectKey)
    throw e
  }
})
