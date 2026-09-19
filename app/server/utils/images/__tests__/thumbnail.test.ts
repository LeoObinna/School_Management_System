/**
 * Tests for the WASM-backed gallery thumbnail generator. Runs the real
 * @jsquash codecs (compiled through the jsquashWasmLoader Vitest hook).
 */
import { describe, it, expect, beforeAll } from 'vitest'
// png ships a sibling wasm-bindgen `.wasm.d.ts` (no default export);
// the build hook actually emits `default: Uint8Array` bytes, read via a
// namespace import and compiled below.
import * as pngEncWasmRaw from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm'
import jpegEncBytes from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'
import jpegDecBytes from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'
import webpEncBytes from '@jsquash/webp/codec/enc/webp_enc.wasm'
import { init as initPngEncode, default as encodePng } from '@jsquash/png/encode'
import {
  init as initJpegEncode,
  default as encodeJpegFixture,
} from '@jsquash/jpeg/encode'
import {
  init as initJpegDecode,
  default as decodeJpeg,
} from '@jsquash/jpeg/decode'
import { init as initWebpEncode, default as encodeWebp } from '@jsquash/webp/encode'
import {
  generateThumbnail,
  isThumbnailable,
  THUMBNAIL_MIME,
  THUMBNAIL_MAX_WIDTH,
  thumbObjectKeyFor,
} from '../thumbnail'

type InitWithModule = (module: WebAssembly.Module) => Promise<unknown>

function makeImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = Math.round((x / Math.max(1, width - 1)) * 255)
      data[i + 1] = Math.round((y / Math.max(1, height - 1)) * 255)
      data[i + 2] = ((x + y) % 2) * 255
      data[i + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

const SOURCE_W = 800
const SOURCE_H = 600

let pngBytes: Uint8Array
let jpegBytes: Uint8Array
let webpBytes: Uint8Array

// Compile the inlined wasm bytes in this test's own realm — a module
// from another VM realm fails the codec glue's `instanceof` checks.
const toModule = (bytes: Uint8Array): WebAssembly.Module =>
  new WebAssembly.Module(bytes as unknown as BufferSource)
const pngEncBytes = (
  pngEncWasmRaw as unknown as { default: Uint8Array }
).default

beforeAll(async () => {
  await Promise.all([
    initPngEncode(toModule(pngEncBytes)),
    (initJpegEncode as InitWithModule)(toModule(jpegEncBytes)),
    (initJpegDecode as InitWithModule)(toModule(jpegDecBytes)),
    (initWebpEncode as InitWithModule)(toModule(webpEncBytes)),
  ])
  const source = makeImage(SOURCE_W, SOURCE_H)
  pngBytes = new Uint8Array(await encodePng(source))
  jpegBytes = new Uint8Array(await encodeJpegFixture(source, { quality: 90 }))
  webpBytes = new Uint8Array(await encodeWebp(source, { quality: 90 }))
})

describe('isThumbnailable', () => {
  it('accepts jpeg/png/webp and rejects other mimes', () => {
    expect(isThumbnailable('image/jpeg')).toBe(true)
    expect(isThumbnailable('image/png; charset=binary')).toBe(true)
    expect(isThumbnailable('image/webp')).toBe(true)
    expect(isThumbnailable('image/gif')).toBe(false)
    expect(isThumbnailable('image/svg+xml')).toBe(false)
    expect(isThumbnailable(null)).toBe(false)
    expect(isThumbnailable(undefined)).toBe(false)
  })
})

describe('thumbObjectKeyFor', () => {
  it('derives a stable adjacent .thumb.jpg key', () => {
    const key = 'gallery/albums/abc/uuid-photo.jpg'
    expect(thumbObjectKeyFor(key)).toBe(
      'gallery/albums/abc/uuid-photo.jpg.thumb.jpg',
    )
    // Deterministic.
    expect(thumbObjectKeyFor(key)).toBe(thumbObjectKeyFor(key))
  })
})

describe('generateThumbnail', () => {
  it('downscales a PNG to a capped-width JPEG', async () => {
    const out = await generateThumbnail(pngBytes, 'image/png')
    expect(out).not.toBeNull()
    if (!out) return
    expect(out.mimeType).toBe(THUMBNAIL_MIME)
    expect(out.bytes[0]).toBe(0xff)
    expect(out.bytes[1]).toBe(0xd8)
    expect(out.width).toBe(THUMBNAIL_MAX_WIDTH)
    expect(out.height).toBe(
      Math.round((THUMBNAIL_MAX_WIDTH * SOURCE_H) / SOURCE_W),
    )
    // Thumbnail must be substantially smaller than the PNG original.
    expect(out.bytes.length).toBeLessThan(pngBytes.length)

    // Round-trip: output decodes to the advertised dimensions.
    const decoded = await decodeJpeg(
      out.bytes.buffer.slice(
        out.bytes.byteOffset,
        out.bytes.byteOffset + out.bytes.byteLength,
      ) as ArrayBuffer,
    )
    expect(decoded.width).toBe(THUMBNAIL_MAX_WIDTH)
  })

  it('downscales JPEG and WebP sources', async () => {
    const fromJpeg = await generateThumbnail(jpegBytes, 'image/jpeg')
    const fromWebp = await generateThumbnail(webpBytes, 'image/webp')
    expect(fromJpeg?.width).toBe(THUMBNAIL_MAX_WIDTH)
    expect(fromWebp?.width).toBe(THUMBNAIL_MAX_WIDTH)
    expect(fromJpeg?.mimeType).toBe(THUMBNAIL_MIME)
    expect(fromWebp?.mimeType).toBe(THUMBNAIL_MIME)
  })

  it('honours a custom max width preserving aspect ratio', async () => {
    const out = await generateThumbnail(pngBytes, 'image/png', {
      maxWidth: 200,
    })
    expect(out?.width).toBe(200)
    expect(out?.height).toBe(150)
  })

  it('returns null for images already at or below the cap', async () => {
    const smallPng = new Uint8Array(
      await encodePng(makeImage(THUMBNAIL_MAX_WIDTH, 200)),
    )
    expect(await generateThumbnail(smallPng, 'image/png')).toBeNull()
    const tinyPng = new Uint8Array(await encodePng(makeImage(100, 80)))
    expect(await generateThumbnail(tinyPng, 'image/png')).toBeNull()
  })

  it('returns null (does not throw) for unsupported types', async () => {
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>',
    )
    expect(
      await generateThumbnail(svg, 'image/svg+xml'),
    ).toBeNull()
    expect(
      await generateThumbnail(new Uint8Array([1, 2, 3]), 'image/gif'),
    ).toBeNull()
  })

  it('returns null (does not throw) for corrupt bytes', async () => {
    const junk = new Uint8Array(1024).fill(0x42)
    expect(await generateThumbnail(junk, 'image/jpeg')).toBeNull()
    expect(await generateThumbnail(junk, 'image/png')).toBeNull()
    expect(await generateThumbnail(junk, 'image/webp')).toBeNull()
  })

  it('returns null for empty input', async () => {
    expect(
      await generateThumbnail(new Uint8Array(0), 'image/png'),
    ).toBeNull()
  })
})
