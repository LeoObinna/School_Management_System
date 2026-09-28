/**
 * Phase 17: notification preferences + newsletter subscription schemas.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Notification preferences (per-user, per-event, per-channel)
// ---------------------------------------------------------------------------

export const notificationPreferenceUpdateSchema = z
  .object({
    announcementEmail: z.boolean().optional(),
    feeReminderEmail: z.boolean().optional(),
    resultPublishedEmail: z.boolean().optional(),
    paymentReceiptEmail: z.boolean().optional(),
    urgentSms: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one preference field is required.',
  })

export type NotificationPreferenceUpdate = z.infer<
  typeof notificationPreferenceUpdateSchema
>

// ---------------------------------------------------------------------------
// Newsletter subscription (public, unauthenticated)
// ---------------------------------------------------------------------------

export const newsletterSubscribeSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().min(1).max(200).optional(),
})

export type NewsletterSubscribe = z.infer<typeof newsletterSubscribeSchema>

export const newsletterUnsubscribeSchema = z.object({
  email: z.string().email().max(320),
})

export type NewsletterUnsubscribe = z.infer<typeof newsletterUnsubscribeSchema>

// ---------------------------------------------------------------------------
// Admin newsletter list query
// ---------------------------------------------------------------------------

export const newsletterListQuerySchema = z.object({
  status: z.enum(['subscribed', 'unsubscribed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export type NewsletterListQuery = z.infer<typeof newsletterListQuerySchema>
