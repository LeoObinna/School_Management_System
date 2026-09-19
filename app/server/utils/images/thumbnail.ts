/**
 * Gallery thumbnail generation (Phase 12 Part C / Option C).
 *
 * Pure, I/O-free: source bytes in, JPEG bytes out. Runs real WASM
 * codecs (@jsquash — mozjpeg, squoosh PNG, libwebp, squoosh resize)
 * compiled via the `jsquashWasmLoader` build hook, so it works
 * identically in workerd, plain Node dev and Vitest.
 *
 * Design notes:
 * - Raster JPEG/PNG/WebP sources are decoded, downscaled to a capped
 *   width and re-encoded as JPEG. GIF (animation) and SVG (already
 *   resolution-independent) are intentionally unsupported; callers
 *   leave `thumb_object_key` null and the UI shows the original.
 * - Images already at or below the cap return `null` — no pointless
 *   re-encode of small originals.
 * - Any decode/resize/encode failure resolves to `null` rather than
 *   throwing: thumbnails are a derived cache and must never block an
 *   upload or a view.
 */

// Gallery grid tiles render at ~128–200 CSS px; 480 covers 2× DPR.
export const THUMBNAIL_MAX_WIDTH = 480
export const THUMBNAIL_QUALITY = 82
export const THUMBNAIL_MIME = 'image/jpeg'

// Refuse pathological dimensions to bound WASM CPU/memory use.
const MAX_SOURCE_DIMENSION = 10_000

export interface ThumbnailOutput {
  bytes: Uint8Array
  mimeType: typeof THUMBNAIL_MIME
  width: number
  height: number
}

export interface ThumbnailOptions {
  maxWidth?: number
  quality?: number
}

/**
 * Deterministic thumbnail key for an original object key. Appending a
 * suffix (rather than rewriting the extension) keeps the two objects
 * adjacent in listings and preserves the original name verbatim.
 */
export function thumbObjectKeyFor(objectKey: string): string {
  return `${objectKey}.thumb.jpg`
}

// ---------------------------------------------------------------------------
// Lazy one-time codec initialization. Dynamic imports keep the ~1 MB of
// wasm (base64-inlined) in a separate chunk that is only evaluated when
// an image actually needs processing.
// ---------------------------------------------------------------------------

let codecsReady: Promise<void> | null = null

async function initCodecs(): Promise<void> {
  if (codecsReady) return codecsReady
  codecsReady = (async () => {
    const [
      pngWasm,
      jpegDecWasm,
      jpegEncWasm,
      webpDecWasm,
      resizeWasm,
      pngDecode,
      jpegDecodeMod,
      jpegEncodeMod,
      webpDecode,
      resizeMod,
    ] = await Promise.all([
      import('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'),
      import('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'),
      import('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'),
      import('@jsquash/webp/codec/dec/webp_dec.wasm'),
      import('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm'),
      import('@jsquash/png/decode'),
      import('@jsquash/jpeg/decode'),
      import('@jsquash/jpeg/encode'),
      import('@jsquash/webp/decode'),
      import('@jsquash/resize'),
    ])

    // The jpeg package's published d.ts predates its WebAssembly.Module
    // overload; the runtime accepts it (verified with the codecs).
    type InitWithModule = (module: WebAssembly.Module) => Promise<unknown>
    // The build hook hands us raw wasm bytes; compile in THIS realm so
    // the glue's `instanceof WebAssembly.Module` checks hold even when
    // the bytes module was cached across VM realms (Vitest per-file
    // jsdom environments). The png/resize packages additionally ship
    // sibling `.wasm.d.ts` files describing the raw wasm-bindgen
    // exports rather than the default bytes, hence the unknown casts.
    const compiled = (m: unknown): WebAssembly.Module =>
      new WebAssembly.Module(
        (m as { default: Uint8Array }).default as unknown as BufferSource,
      )

    await Promise.all([
      pngDecode.init(compiled(pngWasm)),
      (jpegDecodeMod.init as InitWithModule)(compiled(jpegDecWasm)),
      (jpegEncodeMod.init as InitWithModule)(compiled(jpegEncWasm)),
      webpDecode.init(compiled(webpDecWasm)),
      resizeMod.initResize(compiled(resizeWasm)),
    ])

    decoderByMime.set('image/jpeg', (b) => jpegDecodeMod.default(toArrayBuffer(b)))
    decoderByMime.set('image/png', (b) => pngDecode.default(toArrayBuffer(b)))
    decoderByMime.set('image/webp', (b) => webpDecode.default(toArrayBuffer(b)))
    encodeJpeg = jpegEncodeMod.default
    resizeImage = resizeMod.default
  })()
  return codecsReady
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // The codecs require a plain ArrayBuffer; copy in case this is a
  // pooled/full-difference view larger than the actual image.
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

const decoderByMime = new Map<string, (bytes: Uint8Array) => Promise<ImageData>>()
let encodeJpeg: (
  data: ImageData,
  options?: { quality?: number },
) => Promise<ArrayBuffer>
let resizeImage: (
  data: ImageData,
  options: { width: number; height: number; method: 'lanczos3' },
) => Promise<ImageData>

const SUPPORTED_THUMBNAIL_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
type SupportedImageMime = (typeof SUPPORTED_THUMBNAIL_MIMES)[number]

/** MIME types for which a thumbnail can be generated. */
export function isThumbnailable(mimeType: string | null | undefined): boolean {
  return normalizeImageMime(mimeType) !== null
}

/**
 * Reduces a Content-Type value to its bare media type, returning one of
 * the supported image types or null. Tolerates parameters such as
 * `image/png; charset=binary` and surrounding whitespace/case.
 */
function normalizeImageMime(
  mimeType: string | null | undefined,
): SupportedImageMime | null {
  if (!mimeType) return null
  const base = mimeType.split(';')[0]!.trim().toLowerCase()
  return (SUPPORTED_THUMBNAIL_MIMES as readonly string[]).includes(base)
    ? (base as SupportedImageMime)
    : null
}

/**
 * Produces a width-capped JPEG thumbnail. Returns `null` when the source
 * type is unsupported, the image is already small enough, or processing
 * fails for any reason. Never throws.
 */
export async function generateThumbnail(
  bytes: Uint8Array,
  mimeType: string | null | undefined,
  options: ThumbnailOptions = {},
): Promise<ThumbnailOutput | null> {
  const maxWidth = options.maxWidth ?? THUMBNAIL_MAX_WIDTH
  const quality = options.quality ?? THUMBNAIL_QUALITY
  const mime = normalizeImageMime(mimeType)
  if (!mime || bytes.length === 0) {
    return null
  }
  try {
    await initCodecs()
    const decode = decoderByMime.get(mime)
    if (!decode) return null

    const source = await decode(bytes)
    if (
      !source.width
      || !source.height
      || source.width > MAX_SOURCE_DIMENSION
      || source.height > MAX_SOURCE_DIMENSION
    ) {
      return null
    }
    // Never upscale; small originals serve as their own tile.
    if (source.width <= maxWidth) {
      return null
    }

    const targetWidth = maxWidth
    const targetHeight = Math.max(
      1,
      Math.round((targetWidth * source.height) / source.width),
    )
    const resized = await resizeImage(source, {
      width: targetWidth,
      height: targetHeight,
      method: 'lanczos3',
    })
    const encoded = await encodeJpeg(resized, { quality })
    if (!encoded || encoded.byteLength === 0) return null
    const out = new Uint8Array(encoded)
    // Sanity: must actually be a JPEG.
    if (out[0] !== 0xff || out[1] !== 0xd8) return null
    return {
      bytes: out,
      mimeType: THUMBNAIL_MIME,
      width: targetWidth,
      height: targetHeight,
    }
  } catch {
    return null
  }
}
