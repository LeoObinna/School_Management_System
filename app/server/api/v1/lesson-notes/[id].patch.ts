/** PATCH /api/v1/lesson-notes/:id — owning teacher or admin (Phase 16D). */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { idParamSchema, lessonNoteUpdateSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { updateLessonNote } from '~/server/services/lesson-notes'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(lessonNoteUpdateSchema, await readBody(event))
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  const note = await updateLessonNote(id, data, actor)
  await writeAudit(event, {
    userId: actor.userId,
    action: 'lesson_note.update',
    resource: 'lesson_note',
    resourceId: id,
    description: `Updated lesson note "${note.title}".`,
  })
  return note
})
