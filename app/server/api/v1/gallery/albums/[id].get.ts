/** GET /api/v1/gallery/albums/:id */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getAlbum } from '~/server/services/events'

export default defineEventHandler((event) => {
  requirePermission(event, 'gallery.view')
  const { id } = parseInput(idParamSchema, { id: getRouterParam(event, 'id') })
  return getAlbum(id)
})
