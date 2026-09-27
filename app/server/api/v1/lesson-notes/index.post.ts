/** POST /api/v1/lesson-notes — create a note as the calling teacher (Phase 16D). */
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { lessonNoteCreateSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { createLessonNote } from '~/server/services/lesson-notes'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.manage')
  const data = parseBody(lessonNoteCreateSchema, await readBody(event))
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  const note = await createLessonNote(data, actor)
  await writeAudit(event, {
    userId: actor.userId,
    action: 'lesson_note.create',
    resource: 'lesson_note',
    resourceId: note.id,
    description: `Created lesson note "${note.title}".`,
  })
  return note
})
