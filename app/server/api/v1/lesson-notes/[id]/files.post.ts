/**
 * POST /api/v1/lesson-notes/:id/files — multipart attachment upload
 * (Phase 16D). Bytes go to R2 under `lesson-notes/`; metadata in D1.
 */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { addLessonNoteFile } from '~/server/services/lesson-notes'
import {
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import { readUpload } from '~/server/utils/multipart'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.manage')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')

  const { file, meta } = await readUpload(event, 'lesson_note_attachment')
  const objectKey = buildObjectKey(
    'lesson-notes',
    [id],
    meta.fileName,
    crypto.randomUUID(),
  )
  await putObject(event, objectKey, await file.arrayBuffer(), meta.mimeType)
  try {
    const saved = await addLessonNoteFile(
      id,
      {
        objectKey,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      },
      actor,
    )
    await writeAudit(event, {
      userId: actor.userId,
      action: 'lesson_note_file.upload',
      resource: 'lesson_note',
      resourceId: id,
      description: `Attached ${meta.fileName} to a lesson note.`,
    })
    return saved
  } catch (e) {
    // Metadata failed to persist — do not leave an orphaned object.
    await deleteObject(event, objectKey)
    throw e
  }
})
