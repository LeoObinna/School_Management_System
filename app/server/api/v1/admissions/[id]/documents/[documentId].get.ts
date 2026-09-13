/** GET /api/v1/admissions/:id/documents/:documentId */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { getDocumentForDownload } from '~/server/services/admissions'
import { streamObject } from '~/server/utils/storage'

const paramsSchema = z.object({ id: uuidSchema, documentId: uuidSchema })

export default defineEventHandler(async (event) => {
  requirePermission(event, 'admissions.documents.view')
  const { id, documentId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    documentId: getRouterParam(event, 'documentId'),
  })
  const document = await getDocumentForDownload(id, documentId)
  return streamObject(event, document.objectKey, document.fileName, document.mimeType)
})
