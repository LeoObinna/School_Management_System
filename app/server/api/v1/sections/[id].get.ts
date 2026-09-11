/**
 * GET /api/v1/sections/{id}
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getSectionOrThrow } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'sections.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const { db } = await import('~/server/utils/db')
  return getSectionOrThrow(db, id)
})
