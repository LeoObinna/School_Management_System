/**
 * Export helpers shared by report/list routes (Phase 12 Part C
 * Option B).
 *
 * Every tabular endpoint supports three formats:
 *
 * - `json` (default) — the normal API response;
 * - `csv` — flat text, historical behaviour;
 * - `xlsx` — OOXML workbook rendered with `write-excel-file/universal`
 *   (zero Node APIs, works in the Cloudflare Workers runtime and in
 *   plain Node dev).
 *
 * Routes keep their existing two-permission pattern: the base
 * `*.view` permission gates the JSON response, and the corresponding
 * `*.export` permission is required for `csv`/`xlsx` (enforced at the
 * call site, not in here — the export slug differs per domain).
 */
import { getQuery, setHeader, type H3Event } from 'h3'
import writeXlsxFile from 'write-excel-file/universal'
import {
  exportFormatSchema,
  type ExportFormat,
} from '../../shared/schemas'
import { parseInput } from './validation'

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Values that can appear in a tabular export cell. NUMERIC money/score
// columns stay strings so they never lose decimal precision in Excel.
export type ExportCell = string | number | boolean | null
export type ExportRow = ExportCell[]

/**
 * Validates a raw `format` param value. Unknown values 422 (previously
 * they silently fell through to JSON). `undefined` defaults to json.
 */
export function parseFormatValue(raw: unknown): ExportFormat {
  return parseInput(exportFormatSchema, raw ?? 'json')
}

/**
 * Reads and validates `?format=` from the request query. Unknown
 * values 422 (previously they silently fell through to JSON).
 * Defaults to `json`.
 */
export function parseFormat(event: H3Event): ExportFormat {
  return parseFormatValue(getQuery(event).format)
}

// RFC 4180 CSV cell: quote when needed and double embedded quotes.
export function csvCell(value: ExportCell): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Joins headers + rows into a CSV document with a trailing newline. */
export function toCsv(headers: string[], rows: ExportRow[]): string {
  const lines = [
    headers.map((h) => csvCell(h)).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

/**
 * Renders an .xlsx workbook (single sheet) from headers + rows. The
 * header row is bold. Returns the zipped OOXML bytes directly — the
 * caller decides whether to store or stream them.
 */
export async function renderXlsx(
  headers: string[],
  rows: ExportRow[],
): Promise<Uint8Array> {
  const sheetData = [
    headers.map((h) => ({ value: h, fontWeight: 'bold' as const })),
    ...rows,
  ]
  const blob = await writeXlsxFile(sheetData).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}

/** Sets xlsx download headers and returns the workbook bytes. */
export async function sendWorkbook(
  event: H3Event,
  filename: string,
  headers: string[],
  rows: ExportRow[],
): Promise<Uint8Array> {
  const bytes = await renderXlsx(headers, rows)
  setHeader(event, 'content-type', XLSX_MIME)
  setHeader(
    event,
    'content-disposition',
    `attachment; filename="${filename}"`,
  )
  return bytes
}

/** Sets CSV download headers and returns the CSV document. */
export function sendCsv(
  event: H3Event,
  filename: string,
  headers: string[],
  rows: ExportRow[],
): string {
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(
    event,
    'content-disposition',
    `attachment; filename="${filename}"`,
  )
  return toCsv(headers, rows)
}
