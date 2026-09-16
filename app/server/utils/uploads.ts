/**
 * Upload validation helpers (README §23: validate type, MIME and size
 * server-side; never trust client filenames).
 *
 * These are pure functions so the policy envelope can be unit-tested.
 * Actual byte transfer lives in `storage.ts` (R2 binding).
 */

// Safety caps per upload category. These protect the Worker/R2 request
// envelope; they are not academic policy.
export const UPLOAD_LIMITS: Record<UploadCategory, number> = {
  assignment_attachment: 25 * 1024 * 1024,
  submission: 25 * 1024 * 1024,
  resource: 50 * 1024 * 1024,
  admission_document: 10 * 1024 * 1024,
  gallery_image: 25 * 1024 * 1024,
}

export type UploadCategory =
  | 'assignment_attachment'
  | 'submission'
  | 'resource'
  | 'admission_document'
  | 'gallery_image'

// Allowed declared MIME types. Magic-byte content sniffing is deferred
// to Phase 12 hardening; for now the declared type must be a known
// school-document category and agree with the filename extension.
const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'image/',
  'text/',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument',
  'application/zip',
]

// Extensions accepted for each MIME category; used to cross-check the
// client-supplied filename against the declared content type.
const MIME_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
  'text/': ['txt', 'csv', 'md', 'json', 'log'],
  'application/msword': ['doc'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument': [
    'docx',
    'xlsx',
    'pptx',
  ],
  'application/zip': ['zip'],
}

// Per-category MIME prefix restrictions. When an entry exists, the
// declared MIME type must start with one of the listed prefixes in
// addition to passing the global allowlist. `gallery_image` only
// accepts true image uploads.
const CATEGORY_MIME_PREFIXES: Partial<Record<UploadCategory, string[]>> = {
  gallery_image: ['image/'],
}

export interface ValidatedUpload {
  fileName: string
  mimeType: string
  sizeBytes: number
  extension: string
}

/** Reduces a client filename to a safe basename (no paths, no surprises). */
export function sanitizeFileName(raw: string): string {
  const base = raw
    .split(/[\\/]/)
    .pop()
    ?.trim()
    // Drop control characters and shell/path-hostile characters.
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"|?*#;{}[\]`$]/g, '')
    .replace(/^\.+/, '')
  return base && base.length > 1 ? base.slice(0, 255) : 'file'
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) =>
    mimeType.startsWith(prefix),
  )
}

/**
 * Validates one uploaded file against its category envelope. Returns a
 * normalized descriptor; throws Error with a user-facing message on
 * rejection (routes convert these to 422).
 */
export function validateUpload(input: {
  fileName: string
  mimeType: string
  sizeBytes: number
  category: UploadCategory
}): ValidatedUpload {
  const fileName = sanitizeFileName(input.fileName)
  const mimeType = input.mimeType.toLowerCase().split(';')[0]!.trim()
  const extension = fileExtension(fileName)

  if (input.sizeBytes <= 0) {
    throw new Error('The uploaded file is empty.')
  }
  const limit = UPLOAD_LIMITS[input.category]
  if (input.sizeBytes > limit) {
    throw new Error(
      `File exceeds the ${Math.round(limit / (1024 * 1024))} MB limit.`,
    )
  }
  if (!mimeType || !isAllowedMimeType(mimeType)) {
    throw new Error(`File type "${mimeType || 'unknown'}" is not allowed.`)
  }
  const categoryPrefixes = CATEGORY_MIME_PREFIXES[input.category]
  if (
    categoryPrefixes &&
    !categoryPrefixes.some((prefix) => mimeType.startsWith(prefix))
  ) {
    throw new Error(
      `File type "${mimeType}" is not allowed for this upload category.`,
    )
  }
  const match = Object.entries(MIME_EXTENSIONS).find(([prefix]) =>
    mimeType.startsWith(prefix),
  )
  if (match && (!extension || !match[1].includes(extension))) {
    throw new Error(
      'File extension does not match the declared file type.',
    )
  }
  return { fileName, mimeType, sizeBytes: input.sizeBytes, extension }
}
