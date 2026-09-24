/** PUT /api/v1/documents/:id (metadata only) */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { documentUpdateSchema, idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { updateDocument } from '~/server/services/documents'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'documents.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(documentUpdateSchema, await readBody(event))
  const actor = await resolveActorProfile(event, 'documents.manage')
  const document = await updateDocument(id, data, actor)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'document.update',
    resource: 'document',
    resourceId: id,
    description: `Updated document "${document.title}".`,
  })
  return document
})
