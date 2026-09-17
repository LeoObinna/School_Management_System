/**
 * Object storage access (README §23).
 *
 * Bytes live in Cloudflare R2 through the `R2_BUCKET` Worker binding
 * declared in wrangler.toml. PostgreSQL stores only metadata + the
 * object key. This module defines the small structural surface the SMS
 * uses (put/get/delete) so the app does not depend on
 * @cloudflare/workers-types at build time.
 *
 * In plain Node dev (`nuxt dev`) the binding does not exist; callers
 * receive a clear 503. Local object I/O runs through
 * `wrangler pages dev`, staging or production (Phase 13 wires envs).
 */
import type { H3Event } from 'h3'
import { createError, setHeader } from 'h3'

/** Structural subset of the Cloudflare R2Bucket API the SMS relies on. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  delete(key: string): Promise<void>
}

export interface R2ObjectLike {
  body: ReadableStream | null
  httpMetadata?: { contentType?: string }
  size?: number
  writtenHttpMetadata?: { contentType?: string }
}

interface CloudflareEventContext {
  cloudflare?: {
    env?: Record<string, unknown>
  }
}

export function getR2Bucket(event: H3Event): R2BucketLike {
  const binding = (event.context as CloudflareEventContext).cloudflare?.env
    ?.R2_BUCKET
  if (!binding) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Storage Unavailable',
      message:
        'Object storage is not configured in this environment. Run the app via wrangler or configure the R2_BUCKET binding.',
    })
  }
  return binding as R2BucketLike
}

/** Builds a deterministic, collision-safe object key for a category. */
export function buildObjectKey(
  prefix: string,
  scopeParts: string[],
  fileName: string,
  randomId: string,
): string {
  const safeScope = scopeParts
    .map((part) => encodeURIComponent(part).replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/')
  const safeName =
    fileName
      .normalize('NFKD')
      .replace(/[^\w. -]/g, '')
      .replace(/\s+/g, '_')
      .slice(-120) || 'file'
  return [prefix, safeScope, `${randomId}-${safeName}`]
    .filter(Boolean)
    .join('/')
}

export async function putObject(
  event: H3Event,
  key: string,
  body: ArrayBuffer | ArrayBufferView,
  contentType: string,
): Promise<void> {
  const bucket = getR2Bucket(event)
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  })
}

export async function deleteObject(
  event: H3Event,
  key: string,
): Promise<void> {
  const bucket = getR2Bucket(event)
  await bucket.delete(key)
}

/**
 * Streams a private R2 object through the authorized API response.
 * Objects are never public; callers must complete authorization first.
 */
export async function streamObject(
  event: H3Event,
  key: string,
  downloadName: string,
  fallbackContentType?: string | null,
): Promise<ReadableStream> {
  const bucket = getR2Bucket(event)
  const object = await bucket.get(key)
  if (!object || !object.body) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Stored file is missing.',
    })
  }
  const contentType =
    fallbackContentType ||
    object.httpMetadata?.contentType ||
    'application/octet-stream'
  const asciiName = downloadName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  setHeader(event, 'Content-Type', contentType)
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  )
  setHeader(event, 'Cache-Control', 'private, max-age=0, no-store')
  return object.body
}
