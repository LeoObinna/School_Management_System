/** DELETE /api/v1/admissions/:id/documents/:documentId */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { deleteDocument } from '~/server/services/admissions'
import { deleteObject } from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema, documentId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'admissions.documents.manage')
  const { id, documentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    documentId: getRouterParam(event, 'documentId'),
  })
  const { detail, objectKey } = await deleteDocument(id, documentId)
  await deleteObject(event, objectKey)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'admission.document.delete',
    resource: 'admission_document',
    resourceId: documentId,
    description: `Deleted a document from application ${detail.applicationNumber}.`,
  })
  return detail
})
