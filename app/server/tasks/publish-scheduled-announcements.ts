/**
 * Scheduled Task: publish due announcements (Phase 13).
 *
 * Invoked by the Cloudflare Cron Trigger every 5 minutes
 * (`[triggers] crons` in wrangler.toml → nitro.scheduledTasks in
 * nuxt.config.ts). Nitro registers tasks by FILE-DERIVED name — this
 * file is publish-scheduled-announcements.ts, so the registered name is
 * exactly "publish-scheduled-announcements", and that is the string
 * listed in scheduledTasks. Nitro's cloudflare-module runtime
 * dispatches the cron to runCronTasks with the Workers env on
 * context.cloudflare.env, like the queue consumer.
 *
 * In local development the task is inert unless run with
 * `wrangler dev --test-scheduled` and a request to /__scheduled.
 *
 * Since Phase 3 (2026-09-23) the application is D1-only: the task
 * requires the DB binding and throws if it is missing.
 */
import { publishDueAnnouncements } from '../services/communication'
import {
  createWorkerD1Database,
  type AppDatabase,
  type D1Database,
} from '../utils/db'
import type { NotificationQueueLike } from '../utils/notifications-queue'

interface TaskEnv {
  DB?: D1Database
  NOTIFICATION_QUEUE?: NotificationQueueLike
}

interface TaskContext {
  cloudflare?: { env?: TaskEnv }
}

export default defineTask({
  meta: {
    // Must equal the file-derived registered name.
    name: 'publish-scheduled-announcements',
    description:
      'Publishes scheduled announcements whose scheduled_for time is due.',
  },
  async run(payload: { context?: TaskContext }) {
    const env = payload.context?.cloudflare?.env
    if (!env) {
      throw new Error(
        'Cloudflare env is unavailable in the scheduled task.',
      )
    }

    if (!env.DB || typeof env.DB.prepare !== 'function') {
      // Binding misconfiguration: throw so the cron run surfaces an
      // error instead of silently skipping due announcements.
      throw new Error(
        'The DB (D1) binding is not available in the scheduled task.',
      )
    }
    const { db } = createWorkerD1Database(env.DB)
    return runPublish(db, env.NOTIFICATION_QUEUE ?? null)
  },
})

async function runPublish(
  db: AppDatabase,
  queue: NotificationQueueLike | null,
) {
  const result = await publishDueAnnouncements(db, queue)
  console.log(
    `[cron] publish-scheduled-announcements: ${result.published} published, ${result.notified} recipients.`,
  )
  return { result: 'success', ...result }
}
