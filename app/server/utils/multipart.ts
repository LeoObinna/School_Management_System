/**
 * Multipart upload helpers. Nitro routes receive files through the web
 * FormData API (`readFormData`), which works on both the Node dev
 * server and the Cloudflare Workers runtime.
 */
import { createError, type H3Event, readFormData } from 'h3'
import {
  assertSniffMatchesDeclared,
  sniffMagicBytes,
  validateUpload,
  type UploadCategory,
  type ValidatedUpload,
} from './uploads'

export interface ParsedUpload {
  form: FormData
  file: File
  meta: ValidatedUpload
}

function fileError(message: string) {
  return createError({
    statusCode: 422,
    statusMessage: 'Unprocessable Content',
    message: 'Validation failed.',
    data: { errors: { file: [message] } },
  })
}

/** Reads a multipart request and validates its single `file` part. */
export async function readUpload(
  event: H3Event,
  category: UploadCategory,
): Promise<ParsedUpload> {
  let form: FormData
  try {
    form = await readFormData(event)
  } catch {
    throw createError({
      statusCode: 422,
      statusMessage: 'Unprocessable Content',
      message: 'Expected a multipart/form-data request.',
    })
  }
  const entry = form.get('file')
  if (!(entry instanceof File)) {
    throw fileError('A file part named "file" is required.')
  }
  if (entry.size === 0) {
    throw fileError('The uploaded file is empty.')
  }
  try {
    const meta = validateUpload({
      fileName: entry.name,
      mimeType: entry.type || 'application/octet-stream',
      sizeBytes: entry.size,
      category,
    })
    // Magic-byte content sniff (Phase 12 hardening): verify the actual
    // bytes agree with the declared MIME. Reads only the leading 512
    // bytes via a Blob slice, so the whole file is not loaded for this.
    const head = new Uint8Array(
      await entry.slice(0, 512).arrayBuffer(),
    )
    const sniffed = sniffMagicBytes(head)
    assertSniffMatchesDeclared(sniffed, meta.mimeType)
    return { form, file: entry, meta }
  } catch (e) {
    throw fileError(e instanceof Error ? e.message : 'Invalid file.')
  }
}

/** Reads an optional text field from a parsed form. */
export function formString(
  form: FormData,
  name: string,
): string | null | undefined {
  if (!form.has(name)) {
    return undefined
  }
  const value = form.get(name)
  if (value === null) {
    return null
  }
  return typeof value === 'string' ? value : null
}
