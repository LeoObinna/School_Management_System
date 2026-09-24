/** GET /api/v1/documents */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { documentListQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listDocuments } from '~/server/services/documents'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'documents.view')
  const query = parseQueryData(documentListQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'documents.manage')
  return listDocuments(query, actor)
})
