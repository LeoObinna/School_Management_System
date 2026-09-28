/**
 * External notification provider configuration (Phase 17).
 *
 * Shared by the queue consumer (server/plugins/cloudflare-queue.ts) and
 * cron tasks (server/tasks/send-fee-reminders.ts): both receive the raw
 * Workers env and extract the provider credentials + school branding
 * snapshot used to render and deliver external messages.
 *
 * Branding comes from env vars (wrangler secrets/vars) so consumers and
 * cron tasks never need to query the school_settings table. A missing
 * key simply disables that provider — dispatchers record a failed
 * delivery / skip gracefully rather than throwing.
 */
import type { ProviderConfig } from '../services/notification-dispatch'
import type { SchoolBranding } from './email/templates'

export interface ProviderEnv {
  RESEND_API_KEY?: string
  SEND_FROM_EMAIL?: string
  TERMII_API_KEY?: string
  TERMII_SENDER_ID?: string
  SCHOOL_NAME?: string
  SCHOOL_MOTTO?: string
  SCHOOL_PRIMARY_COLOR?: string
  SCHOOL_LOGO_URL?: string
}

/** Extracts the external-provider config from a Workers env object. */
export function extractProviderConfig(env: ProviderEnv): ProviderConfig {
  const resendApiKey = env.RESEND_API_KEY
  const fromEmail = env.SEND_FROM_EMAIL
  const termiiApiKey = env.TERMII_API_KEY
  const termiiSenderId = env.TERMII_SENDER_ID
  const branding: SchoolBranding | undefined = env.SCHOOL_NAME
    ? {
        schoolName: env.SCHOOL_NAME,
        motto: env.SCHOOL_MOTTO ?? null,
        primaryColor: env.SCHOOL_PRIMARY_COLOR ?? '#1a237e',
        logoUrl: env.SCHOOL_LOGO_URL ?? null,
      }
    : undefined
  return {
    ...(resendApiKey && fromEmail
      ? { resend: { apiKey: resendApiKey, fromEmail } }
      : {}),
    ...(termiiApiKey && termiiSenderId
      ? { termii: { apiKey: termiiApiKey, senderId: termiiSenderId } }
      : {}),
    ...(branding ? { branding } : {}),
  }
}
