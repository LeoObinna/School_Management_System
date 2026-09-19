import { describe, it, expect } from 'vitest'
import readXlsxFile from 'read-excel-file/node'
import {
  parseFormatValue,
  toCsv,
  renderXlsx,
  csvCell,
} from '../exports'

describe('csvCell', () => {
  it('passes plain values through', () => {
    expect(csvCell('abc')).toBe('abc')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(null)).toBe('')
  })

  it('quotes commas, quotes and newlines and doubles embedded quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('toCsv', () => {
  it('joins headers and rows with a trailing newline', () => {
    const csv = toCsv(['A', 'B'], [['x', 1], [null, 'y,z']])
    expect(csv).toBe('A,B\nx,1\n,"y,z"\n')
  })
})

describe('parseFormatValue', () => {
  it('defaults to json when the param is absent', () => {
    expect(parseFormatValue(undefined)).toBe('json')
    expect(parseFormatValue(null)).toBe('json')
  })

  it('accepts csv and xlsx', () => {
    expect(parseFormatValue('csv')).toBe('csv')
    expect(parseFormatValue('xlsx')).toBe('xlsx')
    expect(parseFormatValue('json')).toBe('json')
  })

  it('throws 422 for unknown formats', () => {
    expect.assertions(2)
    for (const bad of ['pdf', 'XLSX']) {
      try {
        parseFormatValue(bad)
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).toBe(422)
      }
    }
  })
})

describe('renderXlsx', () => {
  it('produces a zipped xlsx with bold headers round-trippable values', async () => {
    const bytes = await renderXlsx(
      ['Name', 'Count', 'Active'],
      [
        ['Applied', 12, true],
        ['Rejected', 0, false],
        ['Empty stage', null, null],
      ],
    )
    expect(bytes).toBeInstanceOf(Uint8Array)
    // ZIP local-file magic.
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe(
      'PK\u0003\u0004',
    )

    const rows = await readXlsxFile(Buffer.from(bytes))
    expect(rows).toEqual([
      ['Name', 'Count', 'Active'],
      ['Applied', 12, true],
      ['Rejected', 0, false],
      ['Empty stage', null, null],
    ])
  })

  it('keeps decimal strings as text (no float coercion)', async () => {
    const bytes = await renderXlsx(['Invoice', 'Balance'], [
      ['INV-001', '1200.50'],
      ['INV-002', '0.01'],
    ])
    const rows = await readXlsxFile(Buffer.from(bytes))
    expect(rows[1]).toEqual(['INV-001', '1200.50'])
    expect(rows[2]).toEqual(['INV-002', '0.01'])
  })
})
