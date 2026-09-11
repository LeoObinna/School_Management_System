/**
 * GET /api/v1/terms/{id}
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getTermOrThrow } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'terms.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const { db } = await import('~/server/utils/db')
  return getTermOrThrow(db, id)
})
