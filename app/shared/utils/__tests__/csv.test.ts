/**
 * Phase 16D shared CSV parser units. The scores page parses files
 * client-side with the same functions, so these tests pin the exact
 * format the bulk-preview/bulk endpoints receive.
 */
import { describe, expect, it } from 'vitest'
import { parseCsv, parseScoreCsv } from '../csv'

describe('parseCsv', () => {
  it('parses simple comma-separated rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('keeps empty trailing fields and skips the final newline', () => {
    expect(parseCsv('a,b,\n')).toEqual([['a', 'b', '']])
  })

  it('handles CRLF and bare CR line endings', () => {
    expect(parseCsv('a,b\r\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })

  it('supports quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('"a,b","c""d",e')).toEqual([['a,b', 'c"d', 'e']])
  })

  it('supports newlines inside quoted fields', () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([
      ['a', 'line1\nline2', 'c'],
    ])
  })

  it('returns an empty array for empty text', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('parseScoreCsv', () => {
  it('parses rows in any column order and trims cells', () => {
    const text = 'score,subject_code,admission_number\n 75 , MTH , VCS/001 '
    const result = parseScoreCsv(text)
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { admissionNumber: 'VCS/001', subjectCode: 'MTH', score: '75' },
    ])
  })

  it('ignores extra columns', () => {
    const text =
      'admission_number,subject_code,score,comment\nVCS/001,MTH,75,good'
    const result = parseScoreCsv(text)
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { admissionNumber: 'VCS/001', subjectCode: 'MTH', score: '75' },
    ])
  })

  it('reports missing required columns', () => {
    const result = parseScoreCsv('admission_number,score\nVCS/001,75')
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual(['Missing column(s): subject_code.'])
  })

  it('skips blank lines but keeps row numbering by file line', () => {
    const text =
      'admission_number,subject_code,score\nVCS/001,MTH,75\n\n,,\nVCS/002,ENG,'
    const result = parseScoreCsv(text)
    expect(result.rows).toEqual([
      { admissionNumber: 'VCS/001', subjectCode: 'MTH', score: '75' },
    ])
    expect(result.errors).toEqual(['Row 5: missing score.'])
  })

  it('reports an empty file', () => {
    expect(parseScoreCsv('')).toEqual({
      rows: [],
      errors: ['The file is empty.'],
    })
  })

  it('accepts quoted fields containing commas', () => {
    const text = 'admission_number,subject_code,score\n"VCS/0,01",MTH,75'
    const result = parseScoreCsv(text)
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { admissionNumber: 'VCS/0,01', subjectCode: 'MTH', score: '75' },
    ])
  })
})
