/** DELETE /api/v1/lesson-notes/:id/files/:fileId — owning teacher or admin (Phase 16D). */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { deleteLessonNoteFile } from '~/server/services/lesson-notes'
import {
  assertR2Available,
  deleteObject,
} from '~/server/utils/storage'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema, fileId: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'lesson_notes.manage')
  const { id, fileId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    fileId: getRouterParam(event, 'fileId'),
  })
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  // Fail before touching the database when object storage is offline,
  // so metadata and bytes do not diverge.
  assertR2Available(event)
  const { objectKey } = await deleteLessonNoteFile(id, fileId, actor)
  await deleteObject(event, objectKey)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'lesson_note_file.delete',
    resource: 'lesson_note',
    resourceId: fileId,
    description: `Removed attachment from lesson note ${id}.`,
  })
  return { message: 'Attachment removed.' }
})
