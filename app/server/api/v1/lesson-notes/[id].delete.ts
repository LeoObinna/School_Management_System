/** DELETE /api/v1/lesson-notes/:id — owning teacher or admin (Phase 16D). */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { deleteLessonNote } from '~/server/services/lesson-notes'
import { deleteObject } from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  const { objectKeys } = await deleteLessonNote(id, actor)
  // Bytes outlive the row only long enough to be removed; a failed
  // delete leaves an orphaned object but never a dangling reference.
  for (const objectKey of objectKeys) {
    await deleteObject(event, objectKey)
  }
  await writeAudit(event, {
    userId: actor.userId,
    action: 'lesson_note.delete',
    resource: 'lesson_note',
    resourceId: id,
    description: `Deleted lesson note and ${objectKeys.length} attachment(s).`,
  })
  return { message: 'Lesson note deleted.' }
})
