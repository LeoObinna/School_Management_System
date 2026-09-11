/**
 * GET /api/v1/academic-sessions/{id}
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getSessionOrThrow } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'academic_sessions.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const { db } = await import('~/server/utils/db')
  return getSessionOrThrow(db, id)
})
