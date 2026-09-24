/** GET /api/v1/documents/:id/download */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getDocumentForActor } from '~/server/services/documents'
import { streamObject } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'documents.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'documents.manage')
  const access = await getDocumentForActor(id, actor)
  return streamObject(
    event,
    access.objectKey,
    access.document.fileName,
    access.document.mimeType,
  )
})
