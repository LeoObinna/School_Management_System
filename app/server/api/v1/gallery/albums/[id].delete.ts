/** DELETE /api/v1/gallery/albums/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { deleteAlbum } from '~/server/services/events'
import { deleteObjects } from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'gallery.manage')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const { objectKeys, thumbObjectKeys } = await deleteAlbum(id)
  // Best-effort R2 cleanup; failures do not break the request (R2 may be
  // unavailable in plain Node dev — 503 is swallowed).
  await deleteObjects(event, [...objectKeys, ...thumbObjectKeys]).catch(
    () => {},
  )
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'gallery.album.delete',
    resource: 'gallery_album',
    resourceId: id,
    description: `Deleted album ${id} (${objectKeys.length} images).`,
  })
})
