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
 */
import { publishDueAnnouncements } from '../services/communication'
import { createWorkerDatabase } from '../utils/db'
import type { NotificationQueueLike } from '../utils/notifications-queue'

interface TaskEnv {
  HYPERDRIVE?: { connectionString?: string }
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
    const connectionString = env?.HYPERDRIVE?.connectionString
    if (!connectionString) {
      // Binding misconfiguration: throw so the cron run surfaces an
      // error instead of silently skipping due announcements.
      throw new Error(
        'HYPERDRIVE binding is unavailable in the scheduled task.',
      )
    }

    const { db, sql } = createWorkerDatabase(connectionString)
    try {
      const result = await publishDueAnnouncements(
        db,
        env.NOTIFICATION_QUEUE ?? null,
      )
      console.log(
        `[cron] publish-scheduled-announcements: ${result.published} published, ${result.notified} recipients.`,
      )
      return { result: 'success', ...result }
    } finally {
      try {
        await sql.end({ timeout: 2 })
      } catch {
        // Best-effort; the runtime reaps invocation sockets.
      }
    }
  },
})
