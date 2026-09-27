/** GET /api/v1/lesson-notes/:id — scoped detail (Phase 16D). */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getLessonNote } from '~/server/services/lesson-notes'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.view')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  return getLessonNote(id, actor)
})
