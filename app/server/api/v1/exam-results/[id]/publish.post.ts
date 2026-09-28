/** POST /api/v1/exam-results/:id/publish */
import { defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseInput } from '~/server/utils/validation'
import { idParamSchema } from '~/shared/schemas'
import {
  getActor,
  publishPublication,
} from '~/server/services/exams'
import { writeAudit } from '~/server/utils/audit'
import {
  getNotificationQueue,
  sendNotification,
} from '~/server/utils/notifications-queue'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'exam_results.publish')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const actor = await getActor(auth, 'exam_results.publish')
  const publication = await publishPublication(id, actor)

  // Phase 17C: fan out result-published notifications (in-app + email)
  // via the notification queue. Best-effort: the publication is already
  // committed, so a fan-out failure must not fail the publish response.
  const queue = getNotificationQueue(event)
  if (queue) {
    try {
      await sendNotification(queue, {
        kind: 'result.published',
        publicationId: id,
      })
    } catch (error) {
      console.error('[exam-results] failed to enqueue result.published:', error)
    }
  } else {
    console.info(
      '[exam-results] no notification queue binding; skipping result.published fan-out.',
    )
  }

  await writeAudit(event, {
    userId: auth.user.id,
    action: 'result.publish',
    resource: 'result_publication',
    resourceId: publication.id,
    description: `Published results for ${publication.className}.`,
  })
  return publication
})
