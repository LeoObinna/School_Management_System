/** GET /api/v1/assignments/:id/submissions */
import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput, parseQueryData } from '~/server/utils/validation'
import {
  idParamSchema,
  submissionListQuerySchema,
} from '~/shared/schemas'
import { listSubmissions } from '~/server/services/assignments'
import { resolveActorProfile } from '~/server/utils/auth/actor'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'submissions.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const query = parseQueryData(submissionListQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'assignments.create')
  return listSubmissions(id, query, actor)
})
