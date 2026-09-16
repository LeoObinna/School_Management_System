/** PUT /api/v1/gallery/albums/:id */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { albumUpdateSchema, idParamSchema } from '~/shared/schemas'
import { updateAlbum } from '~/server/services/events'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'gallery.manage')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  const data = parseBody(albumUpdateSchema, await readBody(event))
  const album = await updateAlbum(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'gallery.album.update',
    resource: 'gallery_album',
    resourceId: album.id,
    description: `Updated album "${album.title}".`,
  })
  return album
})
