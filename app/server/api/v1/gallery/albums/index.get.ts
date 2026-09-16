/** GET /api/v1/gallery/albums */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { albumListQuerySchema } from '~/shared/schemas'
import { listAlbums } from '~/server/services/events'

export default defineEventHandler((event) => {
  requirePermission(event, 'gallery.view')
  const query = parseQueryData(albumListQuerySchema, getQuery(event))
  return listAlbums(query)
})
