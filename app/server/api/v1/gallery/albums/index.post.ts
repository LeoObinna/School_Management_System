/** POST /api/v1/gallery/albums */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { albumCreateSchema } from '~/shared/schemas'
import { createAlbum } from '~/server/services/events'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'gallery.manage')
  const data = parseBody(albumCreateSchema, await readBody(event))
  const album = await createAlbum(data, { userId: auth.user.id })
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'gallery.album.create',
    resource: 'gallery_album',
    resourceId: album.id,
    description: `Created album "${album.title}".`,
  })
  setResponseStatus(event, 201)
  return album
})
