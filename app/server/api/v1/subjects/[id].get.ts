/**
 * GET /api/v1/subjects/{id}
 */
import { defineEventHandler, getRouterParams } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { getSubjectOrThrow } from '~/server/services/academic-structure'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'subjects.view')
  const { id } = parseInput(idParamSchema, getRouterParams(event))
  const { db } = await import('~/server/utils/db')
  return getSubjectOrThrow(db, id)
})
