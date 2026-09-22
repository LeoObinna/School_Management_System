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
 * Dispatch (Phase 1, 2026-09-22):
 *   1. HYPERDRIVE present → use the Hyperdrive path (current default).
 *   2. HYPERDRIVE absent and DB (D1) present → use the D1 path.
 *      Inert until Phase 2 schema rewrite.
 *   3. Neither present → throw so the cron run surfaces an error.
 */
import { publishDueAnnouncements } from '../services/communication'
import {
  createWorkerDatabase,
  createWorkerD1Database,
  type D1Database,
  type SmsDatabase,
  type SmsD1Database,
} from '../utils/db'
import type { NotificationQueueLike } from '../utils/notifications-queue'

interface TaskEnv {
  HYPERDRIVE?: { connectionString?: string }
  DB?: D1Database
  NOTIFICATION_QUEUE?: NotificationQueueLike
}

interface TaskContext {
  cloudflare?: { env?: TaskEnv }
}

type AnyDb = SmsDatabase | SmsD1Database

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

    // Hyperdrive-first dispatch. Falls back to D1 when Hyperdrive is
    // decommissioned (Phase 6+). The D1 path needs no cleanup.
    if (env.HYPERDRIVE?.connectionString) {
      const { db, sql } = createWorkerDatabase(env.HYPERDRIVE.connectionString)
      try {
        return await runPublish(db as AnyDb, env.NOTIFICATION_QUEUE ?? null)
      } finally {
        try {
          await sql.end({ timeout: 2 })
        } catch {
          // Best-effort; the runtime reaps invocation sockets.
        }
      }
    }

    if (env.DB && typeof env.DB.prepare === 'function') {
      const { db } = createWorkerD1Database(env.DB)
      return await runPublish(db as AnyDb, env.NOTIFICATION_QUEUE ?? null)
    }

    // Binding misconfiguration: throw so the cron run surfaces an
    // error instead of silently skipping due announcements.
    throw new Error(
      'Neither HYPERDRIVE nor DB (D1) binding is available in the scheduled task.',
    )
  },
})

async function runPublish(
  db: AnyDb,
  queue: NotificationQueueLike | null,
) {
  const result = await publishDueAnnouncements(
    db as SmsDatabase,
    queue,
  )
  console.log(
    `[cron] publish-scheduled-announcements: ${result.published} published, ${result.notified} recipients.`,
  )
  return { result: 'success', ...result }
}
