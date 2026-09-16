import { describe, it, expect } from 'vitest'
import {
  buildObjectKey,
} from '../storage'
import {
  assertSniffMatchesDeclared,
  fileExtension,
  isAllowedMimeType,
  sanitizeFileName,
  sniffMagicBytes,
  validateUpload,
} from '../uploads'

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.of(...values)
}

// Builds a buffer of `length` printable-text bytes ending in a newline,
// used for the text-heuristic sniff cases.
function textBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    out[i] = i % 26 + 0x61 // 'a'..'z'
  }
  out[out.length - 1] = 0x0a // newline
  return out
}

describe('sanitizeFileName', () => {
  it('strips path components', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('C:\\\\Users\\\\me\\\\report.pdf')).toBe(
      'report.pdf',
    )
  })

  it('removes hostile characters and leading dots', () => {
    expect(sanitizeFileName('..#hidden;.txt')).toBe('hidden.txt')
  })

  it('falls back for unusable names', () => {
    expect(sanitizeFileName('   ')).toBe('file')
  })
})

describe('fileExtension / isAllowedMimeType', () => {
  it('extracts lowercase extensions', () => {
    expect(fileExtension('Photo.JPG')).toBe('jpg')
    expect(fileExtension('noextension')).toBe('')
  })

  it('recognizes allowed categories and rejects others', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true)
    expect(isAllowedMimeType('image/png')).toBe(true)
    expect(isAllowedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true)
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false)
    expect(isAllowedMimeType('application/octet-stream')).toBe(false)
  })
})

describe('validateUpload', () => {
  const good = {
    fileName: 'homework.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    category: 'submission' as const,
  }

  it('accepts a valid file', () => {
    const result = validateUpload(good)
    expect(result.fileName).toBe('homework.pdf')
    expect(result.mimeType).toBe('application/pdf')
    expect(result.extension).toBe('pdf')
  })

  it('rejects empty files', () => {
    expect(() => validateUpload({ ...good, sizeBytes: 0 })).toThrow(
      /empty/i,
    )
  })

  it('rejects files over the category limit', () => {
    expect(() =>
      validateUpload({
        ...good,
        sizeBytes: 26 * 1024 * 1024,
      }),
    ).toThrow(/25 MB/)
  })

  it('rejects disallowed MIME types', () => {
    expect(() =>
      validateUpload({ ...good, mimeType: 'application/x-msdownload' }),
    ).toThrow(/not allowed/)
  })

  it('rejects extension/MIME mismatch', () => {
    expect(() =>
      validateUpload({ ...good, fileName: 'homework.exe' }),
    ).toThrow(/extension/)
  })

  it('strips parameters from the declared MIME type', () => {
    const result = validateUpload({
      ...good,
      mimeType: 'text/plain; charset=utf-8',
      fileName: 'notes.txt',
    })
    expect(result.mimeType).toBe('text/plain')
  })

  it('accepts admission documents up to 10 MB', () => {
    const result = validateUpload({
      fileName: 'birth-certificate.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 5 * 1024 * 1024,
      category: 'admission_document',
    })
    expect(result.extension).toBe('pdf')
  })

  it('rejects admission documents over 10 MB', () => {
    expect(() =>
      validateUpload({
        fileName: 'portfolio.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 11 * 1024 * 1024,
        category: 'admission_document',
      }),
    ).toThrow(/10 MB/)
  })

  it('accepts gallery images up to 25 MB', () => {
    const result = validateUpload({
      fileName: 'sports-day.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 5 * 1024 * 1024,
      category: 'gallery_image',
    })
    expect(result.extension).toBe('jpg')
  })

  it('rejects gallery images over 25 MB', () => {
    expect(() =>
      validateUpload({
        fileName: 'huge-photo.png',
        mimeType: 'image/png',
        sizeBytes: 26 * 1024 * 1024,
        category: 'gallery_image',
      }),
    ).toThrow(/25 MB/)
  })

  it('rejects non-image gallery uploads', () => {
    expect(() =>
      validateUpload({
        fileName: 'readme.txt',
        mimeType: 'text/plain',
        sizeBytes: 1024,
        category: 'gallery_image',
      }),
    ).toThrow(/not allowed/)
  })
})

describe('buildObjectKey', () => {
  it('composes prefix, sanitized scope and a unique filename', () => {
    const key = buildObjectKey(
      'assignments/submissions',
      ['uuid-1', 'uuid-2'],
      'My Homework!.pdf',
      'abc',
    )
    expect(key).toBe(
      'assignments/submissions/uuid-1/uuid-2/abc-My_Homework.pdf',
    )
  })
})

describe('sniffMagicBytes', () => {
  it('detects a PDF header', () => {
    expect(
      sniffMagicBytes(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e)),
    ).toBe('application/pdf')
  })

  it('detects PNG, JPEG and GIF', () => {
    expect(
      sniffMagicBytes(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00),
      ),
    ).toBe('image/png')
    expect(sniffMagicBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(
      'image/jpeg',
    )
    expect(sniffMagicBytes(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(
      'image/gif',
    )
  })

  it('detects WebP from the RIFF/WEBP pair', () => {
    const head = bytes(
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
    )
    expect(sniffMagicBytes(head)).toBe('image/webp')
  })

  it('detects ZIP (covers OOXML containers)', () => {
    expect(sniffMagicBytes(bytes(0x50, 0x4b, 0x03, 0x04))).toBe(
      'application/zip',
    )
  })

  it('detects legacy Office OLE compound files', () => {
    expect(
      sniffMagicBytes(
        bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
      ),
    ).toBe('application/x-cfb')
  })

  it('flags MZ (DOS/PE) and ELF executables', () => {
    expect(sniffMagicBytes(bytes(0x4d, 0x5a, 0x90, 0x00))).toBe(
      'application/x-msdownload',
    )
    expect(sniffMagicBytes(bytes(0x7f, 0x45, 0x4c, 0x46))).toBe(
      'application/x-elf',
    )
  })

  it('recognises SVG via leading <svg', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')
    expect(sniffMagicBytes(svg)).toBe('image/svg+xml')
  })

  it('recognises SVG with an XML prolog', () => {
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?>\n<svg width="10"></svg>',
    )
    expect(sniffMagicBytes(svg)).toBe('image/svg+xml')
  })

  it('treats printable text with newlines as text/plain', () => {
    expect(sniffMagicBytes(textBytes(64))).toBe('text/plain')
  })

  it('honours a UTF-8 BOM as text', () => {
    const bom = bytes(0xef, 0xbb, 0xbf, 0x68, 0x69) // "hi"
    expect(sniffMagicBytes(bom)).toBe('text/plain')
  })

  it('rejects control bytes (NUL) as non-text', () => {
    const buf = bytes(0x68, 0x69, 0x00, 0x2e)
    expect(sniffMagicBytes(buf)).toBeNull()
  })

  it('returns null for unknown content', () => {
    expect(sniffMagicBytes(bytes(0x01, 0x02, 0x03, 0x04, 0x05))).toBeNull()
  })

  it('returns null for an empty buffer', () => {
    expect(sniffMagicBytes(new Uint8Array())).toBeNull()
  })
})

describe('assertSniffMatchesDeclared', () => {
  const pdf = 'application/pdf'
  const png = 'image/png'

  it('passes when sniff is null (unknown content)', () => {
    expect(() => assertSniffMatchesDeclared(null, pdf)).not.toThrow()
  })

  it('passes when sniff equals the declared MIME', () => {
    expect(() => assertSniffMatchesDeclared(pdf, pdf)).not.toThrow()
    expect(() => assertSniffMatchesDeclared(png, png)).not.toThrow()
  })

  it('passes when sniff is the ZIP container for an OOXML declared type', () => {
    const oox = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    expect(() =>
      assertSniffMatchesDeclared('application/zip', oox),
    ).not.toThrow()
    expect(() =>
      assertSniffMatchesDeclared('application/zip', 'application/zip'),
    ).not.toThrow()
  })

  it('passes when sniff is OLE for a legacy Office declared type', () => {
    expect(() =>
      assertSniffMatchesDeclared('application/x-cfb', 'application/msword'),
    ).not.toThrow()
    expect(() =>
      assertSniffMatchesDeclared(
        'application/x-cfb',
        'application/vnd.ms-excel',
      ),
    ).not.toThrow()
  })

  it('passes when sniff is text/plain for any text/* declared type', () => {
    expect(() =>
      assertSniffMatchesDeclared('text/plain', 'text/csv'),
    ).not.toThrow()
    expect(() =>
      assertSniffMatchesDeclared('text/plain', 'text/plain'),
    ).not.toThrow()
  })

  it('passes when sniff is SVG for an image/svg+xml declared type', () => {
    expect(() =>
      assertSniffMatchesDeclared('image/svg+xml', 'image/svg+xml'),
    ).not.toThrow()
  })

  it('rejects a PDF sniffed under a PNG declared type', () => {
    expect(() => assertSniffMatchesDeclared(pdf, png)).toThrow(/content/)
  })

  it('rejects a PNG sniffed under a PDF declared type', () => {
    expect(() => assertSniffMatchesDeclared(png, pdf)).toThrow(/content/)
  })

  it('rejects an EXE (MZ) sniffed under a PDF declared type', () => {
    expect(() =>
      assertSniffMatchesDeclared('application/x-msdownload', pdf),
    ).toThrow(/content/)
  })

  it('rejects an ELF sniffed under a PNG declared type', () => {
    expect(() =>
      assertSniffMatchesDeclared('application/x-elf', png),
    ).toThrow(/content/)
  })

  it('rejects text/plain sniffed under a non-text declared type', () => {
    expect(() =>
      assertSniffMatchesDeclared('text/plain', pdf),
    ).toThrow(/content/)
  })
})
