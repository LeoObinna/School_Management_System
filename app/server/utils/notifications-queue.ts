/**
 * Notification queue producer binding (Phase 12 Part B).
 *
 * Structural surface of the Cloudflare Queue producer
 * (`NOTIFICATION_QUEUE` in wrangler.toml) so the app does not depend on
 * @cloudflare/workers-types at build time. Messages are sent as
 * `{ body }` (default v8 serialisation); the consumer receives
 * `message.body` as the original object.
 *
 * The binding exists under the Workers runtime (`wrangler dev`,
 * production). In plain Node dev (`nuxt dev`) it is absent and
 * {@link getNotificationQueue} returns null — callers then dispatch
 * notifications synchronously instead (see communication.ts).
 */
import type { H3Event } from 'h3'
import type { NotificationQueueMessage } from '../services/notification-dispatch'

export interface NotificationQueueLike {
  send(message: { body: NotificationQueueMessage }): Promise<void>
}

interface CloudflareEventContext {
  cloudflare?: {
    env?: Record<string, unknown>
  }
}

/**
 * Returns the NOTIFICATION_QUEUE producer binding for the current
 * request, or null when running outside the Workers runtime.
 */
export function getNotificationQueue(
  event: H3Event,
): NotificationQueueLike | null {
  const binding = (event.context as CloudflareEventContext).cloudflare?.env
    ?.NOTIFICATION_QUEUE
  return (binding as NotificationQueueLike | undefined) ?? null
}

/**
 * Enqueues one notification message. Separated from the binding lookup
 * so services can be unit-tested with a fake producer.
 */
export async function sendNotification(
  queue: NotificationQueueLike,
  message: NotificationQueueMessage,
): Promise<void> {
  await queue.send({ body: message })
}
