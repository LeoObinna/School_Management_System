/**
 * PDF audit certificate renderer (README §26, Phase 12 Part C
 * Option B).
 *
 * Pure function: takes a point-in-time aggregate over the audit log
 * plus the requesting actor and returns PDF bytes. No I/O — the route
 * layer streams the result. Unlike report cards, certificates are not
 * stored: they attest the audit log contents for a filter window at
 * the moment of the request.
 *
 * Uses `pdf-lib` with standard Helvetica fonts (Latin only, same
 * constraint as the report-card renderer).
 */
import {
  PDFDocument,
  StandardFonts,
  PageSizes,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { AuditCertificateSummary } from '../../../shared/types'

export interface AuditCertificateModel {
  generatedAt: string
  generatedBy: {
    name: string
    email: string
  }
  summary: AuditCertificateSummary
}

const PAGE = PageSizes.A4
const MARGIN = 56
const CONTENT_WIDTH = PAGE[0] - MARGIN * 2

const FONT_TITLE = 22
const FONT_SUBTITLE = 12
const FONT_SECTION = 13
const FONT_BODY = 10
const FONT_SMALL = 9
const LINE = 16
const ROW_H = 18

const COLORS = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.42, 0.42, 0.42),
  accent: rgb(0.13, 0.32, 0.6),
  border: rgb(0.7, 0.7, 0.7),
  zebra: rgb(0.96, 0.96, 0.97),
} as const

interface State {
  doc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

async function newState(): Promise<State> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage(PAGE)
  return { doc, page, font, bold, y: PAGE[1] - MARGIN }
}

function paginate(state: State, needed: number): void {
  if (state.y - needed < MARGIN + 40) {
    state.page = state.doc.addPage(PAGE)
    state.y = PAGE[1] - MARGIN
  }
}

function line(
  state: State,
  text: string,
  options: { size?: number; bold?: boolean; color?: typeof COLORS.text } = {},
): void {
  const size = options.size ?? FONT_BODY
  state.page.drawText(text, {
    x: MARGIN,
    y: state.y - size,
    size,
    font: options.bold ? state.bold : state.font,
    color: options.color ?? COLORS.text,
  })
  state.y -= size + 5
}

function centered(
  state: State,
  text: string,
  options: { size?: number; bold?: boolean; color?: typeof COLORS.text } = {},
): void {
  const size = options.size ?? FONT_BODY
  const font = options.bold ? state.bold : state.font
  const width = font.widthOfTextAtSize(text, size)
  state.page.drawText(text, {
    x: MARGIN + (CONTENT_WIDTH - width) / 2,
    y: state.y - size,
    size,
    font,
    color: options.color ?? COLORS.text,
  })
  state.y -= size + 6
}

function rule(state: State): void {
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.y },
    thickness: 0.5,
    color: COLORS.border,
  })
  state.y -= 8
}

function section(state: State, text: string): void {
  paginate(state, LINE * 2)
  state.y -= 4
  line(state, text, {
    size: FONT_SECTION,
    bold: true,
    color: COLORS.accent,
  })
  state.y -= 2
}

// Label/value row: bold label at x, regular value after it, wrapping
// onto continuation lines if too long.
function field(state: State, label: string, value: string): void {
  paginate(state, LINE)
  const size = FONT_BODY
  const labelX = MARGIN
  const valueX = MARGIN + 150
  state.page.drawText(`${label}:`, {
    x: labelX,
    y: state.y - size,
    size,
    font: state.bold,
    color: COLORS.text,
  })
  const maxWidth = MARGIN + CONTENT_WIDTH - valueX
  let rest = value
  let first = true
  while (rest) {
    if (!first) {
      paginate(state, LINE)
      state.y -= 0
    }
    let cut = rest.length
    while (
      cut > 0
      && state.font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
    ) {
      cut -= 1
    }
    if (cut === 0) cut = 1
    const chunk = rest.slice(0, cut).trimStart()
    state.page.drawText(chunk, {
      x: valueX,
      y: state.y - size,
      size,
      font: state.font,
      color: first ? COLORS.text : COLORS.muted,
    })
    state.y -= first ? size + 5 : LINE
    rest = rest.slice(cut)
    first = false
  }
  if (first) state.y -= size + 5 // empty value still advances
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB')
}

function breakdownTable(
  state: State,
  rows: ReadonlyArray<{ action: string; count: number }>,
  total: number,
): void {
  const colAction = CONTENT_WIDTH - 100
  const colCount = 100

  const drawRow = (cells: [string, string], header: boolean): void => {
    paginate(state, ROW_H)
    const y = state.y - ROW_H
    if (header) {
      state.page.drawRectangle({
        x: MARGIN,
        y,
        width: CONTENT_WIDTH,
        height: ROW_H,
        color: COLORS.accent,
      })
    }
    const size = FONT_BODY
    const font = header ? state.bold : state.font
    const color = header ? rgb(1, 1, 1) : COLORS.text
    state.page.drawText(cells[0], {
      x: MARGIN + 6,
      y: y + 5,
      size,
      font,
      color,
    })
    const countWidth = font.widthOfTextAtSize(cells[1], size)
    state.page.drawText(cells[1], {
      x: MARGIN + colAction + colCount - countWidth - 8,
      y: y + 5,
      size,
      font,
      color,
    })
    state.y = y - 1
  }

  drawRow(['Action', 'Records'], true)
  rows.forEach((r, i) => {
    paginate(state, ROW_H)
    if (i % 2 === 1) {
      state.page.drawRectangle({
        x: MARGIN,
        y: state.y - ROW_H,
        width: CONTENT_WIDTH,
        height: ROW_H,
        color: COLORS.zebra,
      })
    }
    drawRow([r.action, String(r.count)], false)
  })

  // Total row.
  paginate(state, ROW_H)
  const y = state.y - ROW_H
  state.page.drawText('Total', {
    x: MARGIN + 6,
    y: y + 5,
    size: FONT_BODY,
    font: state.bold,
    color: COLORS.text,
  })
  const totalText = String(total)
  const totalWidth = state.bold.widthOfTextAtSize(totalText, FONT_BODY)
  state.page.drawText(totalText, {
    x: MARGIN + colAction + colCount - totalWidth - 8,
    y: y + 5,
    size: FONT_BODY,
    font: state.bold,
    color: COLORS.text,
  })
  state.y = y - 1
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.y },
    thickness: 0.5,
    color: COLORS.border,
  })
  state.y -= LINE
}

/**
 * Renders an audit certificate as A4 PDF bytes. The certificate lists
 * its generation context, the exact filter scope, the record window
 * and totals, and a per-action breakdown table.
 */
export async function renderAuditCertificatePdf(
  model: AuditCertificateModel,
): Promise<Uint8Array> {
  const state = await newState()
  const { summary } = model

  centered(state, 'Audit Certificate', {
    size: FONT_TITLE,
    bold: true,
    color: COLORS.accent,
  })
  centered(state, 'School Management System — Activity Attestation', {
    size: FONT_SUBTITLE,
    color: COLORS.muted,
  })
  state.y -= 2
  rule(state)

  section(state, 'Generation')
  field(state, 'Generated at', fmtDateTime(model.generatedAt))
  field(state, 'Generated by', `${model.generatedBy.name} (${model.generatedBy.email})`)

  section(state, 'Scope')
  const f = summary.filters
  if (f.dateFrom || f.dateTo) {
    field(
      state,
      'Period',
      `${fmtDate(f.dateFrom)} to ${fmtDate(f.dateTo)} (inclusive)`,
    )
  } else {
    field(state, 'Period', 'All time')
  }
  field(state, 'Action', f.action ?? 'All actions')
  field(state, 'Resource', f.resource ?? 'All resources')
  field(state, 'User filter', f.userId ?? 'All users')

  section(state, 'Summary')
  field(state, 'Total records', String(summary.total))
  field(state, 'Earliest event', fmtDateTime(summary.earliestAt))
  field(state, 'Latest event', fmtDateTime(summary.latestAt))

  section(state, 'Records by action')
  if (summary.byAction.length === 0) {
    line(state, 'No audit records match the selected scope.', {
      size: FONT_SMALL,
      color: COLORS.muted,
    })
    state.y -= LINE
  } else {
    breakdownTable(state, summary.byAction, summary.total)
  }

  section(state, 'Statement')
  paginate(state, LINE * 3)
  line(state, 'This certificate was generated directly from the system audit log', {
    size: FONT_SMALL,
    color: COLORS.muted,
  })
  line(state, 'for the scope shown above. Audit records are append-only within the', {
    size: FONT_SMALL,
    color: COLORS.muted,
  })
  line(state, 'application; the certificate is a point-in-time extract and is not', {
    size: FONT_SMALL,
    color: COLORS.muted,
  })
  line(state, 'cryptographically signed.', {
    size: FONT_SMALL,
    color: COLORS.muted,
  })

  rule(state)
  line(state, `Reference: audit-certificate-${model.generatedAt.replace(/[:.]/g, '-')}`, {
    size: FONT_SMALL,
    color: COLORS.muted,
  })

  return state.doc.save()
}
