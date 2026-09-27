/** GET /api/v1/lesson-notes — scoped list (Phase 16D). */
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseQueryData } from '~/server/utils/validation'
import { lessonNoteListQuerySchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { listLessonNotes } from '~/server/services/lesson-notes'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.view')
  const query = parseQueryData(lessonNoteListQuerySchema, getQuery(event))
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  return listLessonNotes(query, actor)
})
