import { describe, it, expect } from 'vitest'
import {
  buildObjectKey,
} from '../storage'
import {
  fileExtension,
  isAllowedMimeType,
  sanitizeFileName,
  validateUpload,
} from '../uploads'

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
