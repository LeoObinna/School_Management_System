/**
 * Dependency-free CSV utilities (Phase 16D).
 *
 * Bulk score files are parsed client-side so the preview UX and the
 * API see identical rows; the parser lives in shared/utils so the
 * unit tests (vitest has no Vue plugin) can cover it too. RFC4180
 * semantics: quoted fields may contain commas, newlines and escaped
 * quotes (a pair of double quotes inside a quoted field becomes one);
 * CRLF, LF and bare CR are all row terminators.
 */

/** Parses CSV text into raw string cells. Empty text → []. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      endField()
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++
      endRow()
    } else if (ch === '\n') {
      endRow()
    } else {
      field += ch
    }
  }
  // Final row when the file does not end with a line terminator.
  if (field !== '' || row.length > 0) endRow()
  return rows
}

export interface ScoreCsvRow {
  admissionNumber: string
  subjectCode: string
  score: string
}

export interface ScoreCsvParseResult {
  rows: ScoreCsvRow[]
  errors: string[]
}

const SCORE_COLUMNS = ['admission_number', 'subject_code', 'score'] as const

/**
 * Parses the multi-subject score CSV format:
 * `admission_number,subject_code,score` (header row required, extra
 * columns ignored, blank lines skipped). Rows with missing required
 * cells are excluded and reported in `errors` — the scores page shows
 * them inline before any API call.
 */
export function parseScoreCsv(text: string): ScoreCsvParseResult {
  const parsed = parseCsv(text)
  if (parsed.length === 0) {
    return { rows: [], errors: ['The file is empty.'] }
  }
  const header = parsed[0]!.map((cell) =>
    cell.trim().toLowerCase().replace(/\s+/g, '_'),
  )
  const columnAt = new Map<string, number>()
  header.forEach((name, index) => {
    if (!columnAt.has(name)) columnAt.set(name, index)
  })
  const missing = SCORE_COLUMNS.filter((name) => !columnAt.has(name))
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [`Missing column(s): ${missing.join(', ')}.`],
    }
  }

  const rows: ScoreCsvRow[] = []
  const errors: string[] = []
  for (let i = 1; i < parsed.length; i++) {
    const cells = parsed[i]!
    // Data row 1 sits on file line 2 (header is line 1).
    const rowNumber = i + 1
    if (cells.every((cell) => cell.trim() === '')) continue
    const cell = (name: (typeof SCORE_COLUMNS)[number]) => {
      const at = columnAt.get(name)
      return at === undefined ? '' : (cells[at] ?? '').trim()
    }
    const admissionNumber = cell('admission_number')
    const subjectCode = cell('subject_code')
    const score = cell('score')
    if (!admissionNumber) {
      errors.push(`Row ${rowNumber}: missing admission_number.`)
    }
    if (!subjectCode) {
      errors.push(`Row ${rowNumber}: missing subject_code.`)
    }
    if (!score) {
      errors.push(`Row ${rowNumber}: missing score.`)
    }
    if (admissionNumber && subjectCode && score) {
      rows.push({ admissionNumber, subjectCode, score })
    }
  }
  return { rows, errors }
}
