/** GET /api/v1/lesson-notes/:id/files/:fileId — authorized attachment download (Phase 16D). */
import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { uuidSchema } from '~/shared/schemas'
import { resolveActorProfile } from '~/server/utils/auth/actor'
import { getLessonNoteFile } from '~/server/services/lesson-notes'
import { streamObject } from '~/server/utils/storage'

const paramsSchema = z.object({ id: uuidSchema, fileId: uuidSchema })

export default defineEventHandler(async (event) => {
  requirePermission(event, 'lesson_notes.view')
  const { id, fileId } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
    fileId: getRouterParam(event, 'fileId'),
  })
  const actor = await resolveActorProfile(event, 'lesson_notes.manage')
  const file = await getLessonNoteFile(id, fileId, actor)
  return streamObject(event, file.objectKey, file.fileName, file.mimeType)
})
