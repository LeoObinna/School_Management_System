/**
 * Public website contracts (Phase 18).
 *
 * These schemas describe the unauthenticated `/api/v1/public/*` payloads.
 * They are deliberately separate from the authenticated
 * `schoolPublicSettingsSchema` (any-user branding subset): the public site
 * payload includes the school's bank transfer details (shown on the fees
 * page when populated) and never exposes storage object keys — the logo is
 * referenced by the constant public route URL instead.
 *
 * Later increments extend this module with admission/contact/result
 * schemas (18C/18D).
 *
 * 18B adds the content-section payloads (news, events, gallery,
 * academics). Every list/detail mapper exposes only safe display fields
 * — never author ids, audiences, publication statuses or storage object
 * keys (images are referenced by their public streaming route URL).
 */
import { z } from 'zod'
import { schoolPublicSettingsSchema } from './school-settings'
import { dateStringSchema, emailSchema, uuidSchema } from './common'

/**
 * GET /api/v1/public/school-settings — identity + branding + bank details.
 * Bank fields may be empty strings; the UI hides the bank block unless all
 * three are populated. `logoUrl` is the constant streaming route
 * (`/api/v1/public/logo`) when a logo is set, otherwise null.
 */
export const publicSiteSettingsSchema = schoolPublicSettingsSchema
  .omit({ logoKey: true })
  .extend({
    logoUrl: z.string().nullable(),
    bankName: z.string().trim().max(200).optional().or(z.literal('')),
    accountName: z.string().trim().max(200).optional().or(z.literal('')),
    accountNumber: z.string().trim().max(50).optional().or(z.literal('')),
  })

/**
 * GET /api/v1/public/stats — aggregate counts for the homepage statistics
 * strip. Counts only; no personal data. Rows are filtered to active /
 * non-deleted records so the numbers reflect the current school.
 */
export const publicStatsSchema = z.object({
  students: z.number().int().nonnegative(),
  teachers: z.number().int().nonnegative(),
  classes: z.number().int().nonnegative(),
  subjects: z.number().int().nonnegative(),
})

export type PublicSiteSettings = z.infer<typeof publicSiteSettingsSchema>
export type PublicStats = z.infer<typeof publicStatsSchema>

// ---------------------------------------------------------------------------
// 18B — content sections (news, events, gallery, academics)
// ---------------------------------------------------------------------------

/** Shared list-query shape: small fixed pages, no search/sort exposure. */
const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(24).default(12),
})

/** GET /api/v1/public/news query. */
export const publicNewsListQuerySchema = publicListQuerySchema
export type PublicNewsListQuery = z.infer<typeof publicNewsListQuerySchema>

/** GET /api/v1/public/events query — upcoming (default) or past. */
export const publicEventsListQuerySchema = publicListQuerySchema.extend({
  when: z.enum(['upcoming', 'past']).default('upcoming'),
})
export type PublicEventsListQuery = z.infer<typeof publicEventsListQuerySchema>

/** GET /api/v1/public/gallery/albums query. */
export const publicAlbumsListQuerySchema = publicListQuerySchema
export type PublicAlbumsListQuery = z.infer<typeof publicAlbumsListQuerySchema>

/** GET /api/v1/public/gallery/images/:imageId query. */
export const publicImageQuerySchema = z.object({
  variant: z.enum(['full', 'thumb']).default('full'),
})
export type PublicImageQuery = z.infer<typeof publicImageQuerySchema>

const paginationMetaSchema = z.object({
  currentPage: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  lastPage: z.number().int(),
})

/**
 * One published, audience-all announcement as public news. `publishedAt`
 * is the display date; body is rendered as plain text, never HTML.
 */
export const publicNewsItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string().nullable(),
  publishedAt: z.string().nullable(),
})
export const publicNewsListSchema = z.object({
  data: z.array(publicNewsItemSchema),
  meta: paginationMetaSchema,
})

/** One published, audience-all event. */
export const publicEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  location: z.string().nullable(),
})
export const publicEventsListSchema = z.object({
  data: z.array(publicEventSchema),
  meta: paginationMetaSchema,
})

/**
 * One published gallery album. `coverUrl` points at the public image
 * streaming route (never an R2 object key); `eventTitle` is set only when
 * the linked event is itself published.
 */
export const publicAlbumSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  imageCount: z.number().int().nonnegative(),
  coverUrl: z.string().nullable(),
  eventTitle: z.string().nullable(),
})
export const publicAlbumsListSchema = z.object({
  data: z.array(publicAlbumSchema),
  meta: paginationMetaSchema,
})

/**
 * One image inside a published album. `url`/`thumbUrl` are public
 * streaming route URLs; `thumbUrl` serves the derived thumbnail (falling
 * back to the full image when no thumbnail exists or can be generated).
 */
export const publicImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  thumbUrl: z.string(),
  caption: z.string().nullable(),
  fileName: z.string(),
})
export const publicAlbumDetailSchema = publicAlbumSchema.extend({
  images: z.array(publicImageSchema),
})

/**
 * GET /api/v1/public/academics — current session/terms and the active
 * class structure with subject names. No people data. Classes with no
 * level are grouped under a null level name; the page labels that group.
 */
export const publicAcademicsSchema = z.object({
  session: z
    .object({
      name: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    })
    .nullable(),
  terms: z.array(
    z.object({
      name: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
    }),
  ),
  levels: z.array(
    z.object({
      name: z.string().nullable(),
      classes: z.array(
        z.object({
          // Class id is exposed so the public admissions wizard (18C) can
          // offer a class select.
          id: z.string().uuid(),
          name: z.string(),
          subjects: z.array(z.string()),
        }),
      ),
    }),
  ),
})

// ---------------------------------------------------------------------------
// 18C — public admissions application, status check, contact form
// ---------------------------------------------------------------------------

/**
 * Honeypot: a hidden `_website` field that must stay empty. Bots that fill
 * every field trip it; the routes respond with a generic success-shaped
 * payload without persisting anything, so bots cannot tell they failed.
 * Validated as a bounded string (never rejected) — the routes check for
 * non-empty rather than failing validation, so real users are never
 * blocked by the field.
 */
const honeypotSchema = z.string().max(200).nullish()

/**
 * POST /api/v1/public/admissions/applications — strict subset of the
 * staff application fields; the session is resolved server-side (current
 * session) and the applicant's status always starts at `applied`.
 * At least one guardian contact channel is required: the status checker
 * matches on guardian email or phone.
 */
export const publicApplicationSchema = z
  .object({
    firstName: z.string().trim().min(1).max(150),
    lastName: z.string().trim().min(1).max(150),
    otherNames: z.string().trim().max(150).nullish(),
    gender: z.enum(['male', 'female', 'other']).nullish(),
    dateOfBirth: dateStringSchema.nullish(),
    nationality: z.string().trim().max(100).nullish(),
    guardianName: z.string().trim().min(1).max(255),
    guardianPhone: z.string().trim().max(50).nullish(),
    guardianEmail: emailSchema.nullish(),
    address: z.string().trim().max(2000).nullish(),
    previousSchool: z.string().trim().max(255).nullish(),
    intendedClassId: uuidSchema.nullish(),
    _website: honeypotSchema,
  })
  .refine((d) => Boolean(d.guardianEmail) || Boolean(d.guardianPhone), {
    message: 'Provide a guardian email address or phone number.',
    path: ['guardianEmail'],
  })
export type PublicApplication = z.infer<typeof publicApplicationSchema>

/**
 * Response is deliberately minimal: only the allocated application
 * number. No applicant data is echoed back.
 */
export const publicApplicationResponseSchema = z.object({
  applicationNumber: z.string(),
})
export type PublicApplicationResponse = z.infer<
  typeof publicApplicationResponseSchema
>

/**
 * GET /api/v1/public/admissions/status — exact match on application
 * number plus one guardian contact factor. The route answers a generic
 * 404 for any mismatch so numbers cannot be enumerated.
 */
export const admissionStatusQuerySchema = z
  .object({
    applicationNumber: z
      .string()
      .trim()
      .regex(/^APP-\d{4}-\d{4}$/i, 'Expected an application number like APP-2026-0001'),
    guardianEmail: emailSchema.optional(),
    guardianPhone: z.string().trim().max(50).optional(),
  })
  .refine((d) => Boolean(d.guardianEmail) || Boolean(d.guardianPhone), {
    message: 'Provide the guardian email address or phone number used on the application.',
    path: ['guardianEmail'],
  })
export type AdmissionStatusQuery = z.infer<typeof admissionStatusQuerySchema>

/** Display labels for admission statuses on the public status checker. */
export const ADMISSION_STATUS_LABELS: Record<string, string> = {
  applied: 'Application received',
  documents_submitted: 'Documents submitted',
  under_review: 'Under review',
  assessment_scheduled: 'Assessment scheduled',
  assessed: 'Assessment completed',
  accepted: 'Accepted',
  rejected: 'Not accepted',
  waitlisted: 'Waitlisted',
  admitted: 'Admission offered',
  enrolled: 'Enrolled',
  withdrawn: 'Withdrawn',
}

/**
 * Status response: label only (owner decision — no applicant data, no
 * internal notes, no reviewer identity).
 */
export const admissionStatusResponseSchema = z.object({
  applicationNumber: z.string(),
  status: z.string(),
  statusLabel: z.string(),
})
export type AdmissionStatusResponse = z.infer<
  typeof admissionStatusResponseSchema
>

/**
 * POST /api/v1/public/contact — persisted to the staff contact inbox.
 * `department` is a free-text routing hint (the UI offers generic
 * options); no school policy is encoded.
 */
export const contactMessageCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: emailSchema,
  phone: z.string().trim().max(50).nullish(),
  department: z.string().trim().max(100).nullish(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  _website: honeypotSchema,
})
export type ContactMessageCreate = z.infer<typeof contactMessageCreateSchema>

/** 201 response: a bare acknowledgement, no stored data echoed. */
export const contactMessageResponseSchema = z.object({
  received: z.literal(true),
})
export type ContactMessageResponse = z.infer<
  typeof contactMessageResponseSchema
>
