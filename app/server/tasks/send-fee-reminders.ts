/**
 * Scheduled Task: daily fee reminders (Phase 17C).
 *
 * Runs on the shared every-5-minute Cron Trigger (registered alongside
 * publish-scheduled-announcements in nuxt.config.ts). Because the
 * schedule fires every 5 minutes, the task self-gates to once per UTC
 * day via an EDGE_KV marker key (`cron:fee-reminders:YYYY-MM-DD`); the
 * per-parent `reminder=<date>` link marker in the notifications table
 * additionally makes a mid-run crash safe to re-run without
 * double-notifying anyone.
 *
 * For each parent with overdue invoices (balance > 0, due_date past,
 * status issued/partially_paid/overdue) the task creates ONE in-app
 * notification and sends ONE consolidated email (fee_reminder_email
 * preference permitting) via dispatchFeeReminders.
 *
 * Since Phase 3 (2026-09-23) the application is D1-only: the task
 * requires the DB binding and throws if it is missing. EDGE_KV is also
 * required — without the daily gate the 5-minute schedule would spam
 * parents, so a missing binding fails loudly instead of sending.
 */
import { dispatchFeeReminders } from '../services/notification-dispatch'
import {
  extractProviderConfig,
  type ProviderEnv,
} from '../utils/notification-providers'
import { createWorkerD1Database, type D1Database } from '../utils/db'

interface KvLike {
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>
}

interface TaskEnv extends ProviderEnv {
  DB?: D1Database
  EDGE_KV?: KvLike
}

interface TaskContext {
  cloudflare?: { env?: TaskEnv }
}

export default defineTask({
  meta: {
    // Must equal the file-derived registered name.
    name: 'send-fee-reminders',
    description:
      'Sends one consolidated overdue-fee reminder per parent (once daily).',
  },
  async run(payload: { context?: TaskContext }) {
    const env = payload.context?.cloudflare?.env
    if (!env) {
      throw new Error('Cloudflare env is unavailable in the scheduled task.')
    }
    if (!env.DB || typeof env.DB.prepare !== 'function') {
      throw new Error(
        'The DB (D1) binding is not available in the scheduled task.',
      )
    }
    if (!env.EDGE_KV || typeof env.EDGE_KV.get !== 'function') {
      throw new Error(
        'The EDGE_KV binding is not available in the scheduled task.',
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const markerKey = `cron:fee-reminders:${today}`
    if (await env.EDGE_KV.get(markerKey)) {
      console.log(`[cron] send-fee-reminders: already ran on ${today}; skipping.`)
      return { result: 'skipped', date: today }
    }

    const { db } = createWorkerD1Database(env.DB)
    const config = extractProviderConfig(env)
    const outcome = await dispatchFeeReminders(db, config, today)
    // Mark AFTER a successful run; a crash re-runs safely thanks to the
    // per-parent link-marker dedupe in dispatchFeeReminders.
    await env.EDGE_KV.put(markerKey, new Date().toISOString(), {
      expirationTtl: 60 * 60 * 48,
    })
    console.log(
      `[cron] send-fee-reminders: ${outcome.parentsNotified} parents notified, ${outcome.emailsSent} emails sent.`,
    )
    return { result: 'success', date: today, ...outcome }
  },
})
