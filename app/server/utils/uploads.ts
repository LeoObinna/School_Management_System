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

// ---------------------------------------------------------------------------
// Magic-byte content sniffing (Phase 12 hardening).
//
// Pure helpers: `sniffMagicBytes` returns a canonical MIME family for the
// leading bytes of an uploaded file (or null for unknown content).
// `assertSniffMatchesDeclared` verifies the sniffed family is consistent
// with the declared MIME. Together they defend against renamed payloads
// where the attacker kept the right extension and declared type but the
// bytes are something else (e.g. an EXE renamed to homework.pdf).
// ---------------------------------------------------------------------------

function bytesEqual(
  bytes: Uint8Array,
  offset: number,
  sig: number[],
): boolean {
  if (offset + sig.length > bytes.length) return false
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false
  }
  return true
}

interface Signature {
  mime: string
  offset: number
  sig: number[]
}

// Strong, unambiguous leading signatures. ZIP also matches OOXML
// (.docx/.xlsx/.pptx are ZIP containers); the declared MIME + extension
// cross-check in `validateUpload` disambiguates the Office flavour.
const SIGNATURES: Signature[] = [
  { mime: 'application/pdf', offset: 0, sig: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  {
    mime: 'image/png',
    offset: 0,
    sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: 'image/jpeg', offset: 0, sig: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', offset: 0, sig: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'application/zip', offset: 0, sig: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/zip', offset: 0, sig: [0x50, 0x4b, 0x05, 0x06] }, // empty archive
  { mime: 'application/zip', offset: 0, sig: [0x50, 0x4b, 0x07, 0x08] }, // spanned
  {
    mime: 'application/x-cfb',
    offset: 0,
    sig: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  }, // OLE compound (legacy Office)
  { mime: 'application/x-msdownload', offset: 0, sig: [0x4d, 0x5a] }, // MZ (DOS/PE)
  { mime: 'application/x-elf', offset: 0, sig: [0x7f, 0x45, 0x4c, 0x46] }, // \x7fELF
]

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = bytes.slice(0, Math.min(bytes.length, 512))
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(head)
    .toLowerCase()
  return (
    /^\s*<\?xml[\s\S]*<svg[\s>]/.test(text) || /^\s*<svg[\s>]/.test(text)
  )
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false
  // Optional UTF-8 BOM, or a UTF-16 BOM (treat as text).
  let start = 0
  if (bytesEqual(bytes, 0, [0xef, 0xbb, 0xbf])) {
    start = 3
  } else if (
    bytesEqual(bytes, 0, [0xff, 0xfe]) ||
    bytesEqual(bytes, 0, [0xfe, 0xff])
  ) {
    return true
  }
  const end = Math.min(bytes.length, start + 512)
  for (let i = start; i < end; i++) {
    const b = bytes[i]
    if (b === undefined) {
      continue
    }
    // Reject control bytes other than \t (0x09), \n (0x0a), \r (0x0d),
    // \f (0x0c). High bytes (>=0x80) are allowed for UTF-8 text.
    if ((b >= 0x00 && b <= 0x08) || (b >= 0x0e && b <= 0x1f)) {
      return false
    }
  }
  return true
}

/**
 * Sniffs the leading bytes of an uploaded file and returns a canonical
 * MIME family when a strong signature matches, or null for unknown
 * content. Never throws — unknown content falls back to the declared-MIME
 * check in {@link validateUpload}.
 */
export function sniffMagicBytes(bytes: Uint8Array): string | null {
  for (const { mime, offset, sig } of SIGNATURES) {
    if (bytesEqual(bytes, offset, sig)) return mime
  }
  // WebP: RIFF....WEBP
  if (
    bytesEqual(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && // RIFF
    bytesEqual(bytes, 8, [0x57, 0x45, 0x42, 0x50]) // WEBP
  ) {
    return 'image/webp'
  }
  if (looksLikeSvg(bytes)) return 'image/svg+xml'
  if (looksLikeText(bytes)) return 'text/plain'
  return null
}

/**
 * Throws an Error (routes map to 422) when the sniffed family is
 * incompatible with the declared MIME. Compatible = sniff is null
 * (unknown), OR sniff equals the declared MIME, OR sniff is the
 * container family of the declared type (e.g. sniff application/zip is
 * compatible with declared application/vnd.openxmlformats-officedocument.*).
 */
export function assertSniffMatchesDeclared(
  sniffed: string | null,
  declaredMime: string,
): void {
  if (sniffed === null) return
  if (sniffed === declaredMime) return
  if (
    sniffed === 'application/zip' &&
    (declaredMime === 'application/zip' ||
      declaredMime.startsWith('application/vnd.openxmlformats-officedocument'))
  ) {
    return
  }
  if (
    sniffed === 'application/x-cfb' &&
    (declaredMime === 'application/msword' ||
      declaredMime === 'application/vnd.ms-excel' ||
      declaredMime === 'application/vnd.ms-powerpoint')
  ) {
    return
  }
  if (sniffed === 'text/plain' && declaredMime.startsWith('text/')) return
  if (sniffed === 'image/svg+xml' && declaredMime === 'image/svg+xml') return
  throw new Error('File content does not match the declared type.')
}
