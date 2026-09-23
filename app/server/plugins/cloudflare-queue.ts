/**
 * Cloudflare Queue consumer for notification fan-out (Phase 12 Part B).
 *
 * Nitro's cloudflare-module runtime already exports a `queue()` handler
 * that re-emits each delivered batch as the `cloudflare:queue` hook
 * (nitropack .../cloudflare/runtime/_module-handler.mjs). This plugin
 * registers that hook; the consumer is therefore wired without a
 * custom Worker entry.
 *
 * Semantics:
 *  - D1 is binding-managed, so the thin Drizzle client per batch needs
 *    no socket cleanup (queue invocations are not fetch requests, so
 *    the request-scoped db proxy does not apply).
 *  - Each message is processed independently: success → ack(); a
 *    transient error → retry() (Cloudflare redelivers with backoff); a
 *    malformed payload is a poison message and is ack()ed so it cannot
 *    block the queue forever.
 *  - Fan-out itself is idempotent (partial unique index on
 *    (user_id, announcement_id)), so redelivery after a crash mid-batch
 *    never creates duplicate notifications.
 *
 * Since Phase 3 (2026-09-23) the application is D1-only: the consumer
 * requires the DB binding and throws (leaving the batch unacked) if it
 * is missing.
 */
import { z } from 'zod'
import { dispatchMessage } from '../services/notification-dispatch'
import {
  createWorkerD1Database,
  type AppDatabase,
  type D1Database,
} from '../utils/db'

interface QueueMessageLike {
  id: string
  body: unknown
  ack(): void
  retry(): void
}

// Structural supertype of Nitro's typed `cloudflare:queue` payload
// (which uses @cloudflare/workers-types MessageBatch + `env: unknown`),
// so the hook callback is assignable without importing Workers types.
interface QueueHookPayload {
  batch: { queue: string; messages: QueueMessageLike[] }
  env: unknown
}

interface QueueEnv {
  DB?: D1Database
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook(
    'cloudflare:queue',
    async ({ batch, env }: QueueHookPayload) => {
      const queueEnv = (env as QueueEnv | undefined) ?? {}
      if (!queueEnv.DB || typeof queueEnv.DB.prepare !== 'function') {
        // Binding misconfiguration: leave the batch unacked so the
        // runtime retries it instead of silently dropping notifications.
        throw new Error(
          'The DB (D1) binding is not available in the queue consumer.',
        )
      }
      const { db } = createWorkerD1Database(queueEnv.DB)
      await processBatch(db, batch)
    },
  )
})

async function processBatch(db: AppDatabase, batch: { messages: QueueMessageLike[] }) {
  for (const message of batch.messages) {
    try {
      await dispatchMessage(db, message.body)
      message.ack()
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Malformed/unknown envelope: ack the poison message.
        console.error(
          `[notification-queue] acking malformed message ${message.id}:`,
          error.flatten(),
        )
        message.ack()
      } else {
        // Transient (DB) failure: schedule redelivery.
        console.error(
          `[notification-queue] retrying message ${message.id}:`,
          error,
        )
        message.retry()
      }
    }
  }
}
