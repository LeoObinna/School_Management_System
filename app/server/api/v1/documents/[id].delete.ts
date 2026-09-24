/** DELETE /api/v1/documents/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { deleteDocument } from '~/server/services/documents'
import {
  assertR2Available,
  deleteObject,
} from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'documents.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'documents.manage')
  // Fail before touching the database when object storage is offline,
  // so metadata and bytes do not diverge.
  assertR2Available(event)
  const objectKey = await deleteDocument(id, actor)
  await deleteObject(event, objectKey)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'document.delete',
    resource: 'document',
    resourceId: id,
    description: `Deleted document ${id} and its stored file.`,
  })
  return { ok: true }
})
