/**
 * PDF report-card renderer (README §18, Phase 12 Part C Option A).
 *
 * Pure function: takes the existing `ReportCardDetail` shape and returns
 * a PDF as `Uint8Array` bytes. No I/O, no event, no R2 — the route
 * layer is responsible for storing the result via `putObject` and
 * persisting the object key through `setReportCardObjectKey`.
 *
 * Uses `pdf-lib` (pure JavaScript, Workers-compatible). Only standard
 * Latin fonts (Helvetica) are embedded; Unicode font embedding is
 * deferred (current seed data is ASCII).
 */
import {
  PDFDocument,
  StandardFonts,
  PageSizes,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { ReportCardDetail, SubjectResult } from '../../../shared/types'
import type { H3Event } from 'h3'
import { putObject } from '../storage'

// A4 portrait in points.
const PAGE = PageSizes.A4
const MARGIN = 50
const CONTENT_WIDTH = PAGE[0] - MARGIN * 2

// Table column widths for the subject results table. The order matters;
// right-aligned numeric columns come last.
const COL = {
  subject: 195,
  total: 70,
  max: 70,
  pct: 70,
  grade: 90,
} as const
// Sum = 495; CONTENT_WIDTH = 495.28 — leaves a hair of breathing room.

const FONT_SIZE_TITLE = 20
const FONT_SIZE_HEADER = 13
const FONT_SIZE_BODY = 10
const FONT_SIZE_SMALL = 9
const LINE_HEIGHT = 16
const TABLE_ROW_HEIGHT = 18

const COLORS = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  accent: rgb(0.13, 0.32, 0.6),
  border: rgb(0.7, 0.7, 0.7),
  zebra: rgb(0.96, 0.96, 0.97),
} as const

/**
 * Builds a deterministic, collision-safe R2 object key for a report
 * card PDF. Stable per card so regeneration overwrites the same R2
 * object (R2 puts are idempotent on a given key).
 */
export function buildReportCardObjectKey(card: {
  id: string
  studentId: string
  sessionId: string
  termId: string
}): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')
  return [
    'report-cards',
    safe(card.sessionId),
    safe(card.termId),
    safe(card.studentId),
    `${safe(card.id)}.pdf`,
  ].join('/')
}

interface RenderState {
  doc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

async function newRenderState(): Promise<RenderState> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage(PAGE)
  return { doc, page, font, bold, y: PAGE[1] - MARGIN }
}

// Open a new page when content would overflow the bottom margin.
function paginate(state: RenderState, needed: number): void {
  if (state.y - needed < MARGIN + 40) {
    state.page = state.doc.addPage(PAGE)
    state.y = PAGE[1] - MARGIN
  }
}

function title(
  state: RenderState,
  text: string,
  options: { size?: number; bold?: boolean; color?: typeof COLORS.text } = {},
): void {
  const size = options.size ?? FONT_SIZE_BODY
  const font = options.bold ? state.bold : state.font
  const color = options.color ?? COLORS.text
  state.page.drawText(text, {
    x: MARGIN,
    y: state.y - size,
    size,
    font,
    color,
  })
  state.y -= size + 6
}

function titleCentered(
  state: RenderState,
  text: string,
  options: { size?: number; bold?: boolean; color?: typeof COLORS.text } = {},
): void {
  const size = options.size ?? FONT_SIZE_BODY
  const font = options.bold ? state.bold : state.font
  const color = options.color ?? COLORS.text
  const width = font.widthOfTextAtSize(text, size)
  state.page.drawText(text, {
    x: MARGIN + (CONTENT_WIDTH - width) / 2,
    y: state.y - size,
    size,
    font,
    color,
  })
  state.y -= size + 6
}

// Draws a horizontal rule across the content width.
function rule(state: RenderState, thickness = 0.5): void {
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.y },
    thickness,
    color: COLORS.border,
  })
  state.y -= 8
}

// Subject results table. Header row + one row per subject. Zebra-striped.
function subjectTable(state: RenderState, subjects: SubjectResult[]): void {
  if (subjects.length === 0) {
    title(state, 'No subject results recorded.', {
      size: FONT_SIZE_SMALL,
      color: COLORS.muted,
    })
    state.y -= LINE_HEIGHT
    return
  }

  // Header row.
  const headerY = state.y - TABLE_ROW_HEIGHT
  state.page.drawRectangle({
    x: MARGIN,
    y: headerY,
    width: CONTENT_WIDTH,
    height: TABLE_ROW_HEIGHT,
    color: COLORS.accent,
  })
  drawCell(state, 'Subject', MARGIN, headerY + 5, {
    bold: true,
    color: rgb(1, 1, 1),
  })
  drawCell(state, 'Total', MARGIN + COL.subject, headerY + 5, {
    bold: true,
    align: 'right',
    width: COL.total,
    color: rgb(1, 1, 1),
  })
  drawCell(state, 'Max', MARGIN + COL.subject + COL.total, headerY + 5, {
    bold: true,
    align: 'right',
    width: COL.max,
    color: rgb(1, 1, 1),
  })
  drawCell(
    state,
    'Pct',
    MARGIN + COL.subject + COL.total + COL.max,
    headerY + 5,
    { bold: true, align: 'right', width: COL.pct, color: rgb(1, 1, 1) },
  )
  drawCell(
    state,
    'Grade',
    MARGIN + COL.subject + COL.total + COL.max + COL.pct,
    headerY + 5,
    { bold: true, align: 'right', width: COL.grade, color: rgb(1, 1, 1) },
  )
  state.y = headerY - 2

  // Data rows.
  subjects.forEach((s, i) => {
    paginate(state, TABLE_ROW_HEIGHT + LINE_HEIGHT)
    const rowY = state.y - TABLE_ROW_HEIGHT
    if (i % 2 === 1) {
      state.page.drawRectangle({
        x: MARGIN,
        y: rowY,
        width: CONTENT_WIDTH,
        height: TABLE_ROW_HEIGHT,
        color: COLORS.zebra,
      })
    }
    const label = s.subjectCode
      ? `${s.subjectName} (${s.subjectCode})`
      : s.subjectName
    drawCell(state, truncate(state.font, label, COL.subject - 4), MARGIN, rowY + 5)
    drawCell(state, s.totalScore, MARGIN + COL.subject, rowY + 5, {
      align: 'right',
      width: COL.total,
    })
    drawCell(state, s.maxScore, MARGIN + COL.subject + COL.total, rowY + 5, {
      align: 'right',
      width: COL.max,
    })
    drawCell(
      state,
      `${s.percentage}%`,
      MARGIN + COL.subject + COL.total + COL.max,
      rowY + 5,
      { align: 'right', width: COL.pct },
    )
    drawCell(
      state,
      s.grade ?? '—',
      MARGIN + COL.subject + COL.total + COL.max + COL.pct,
      rowY + 5,
      { align: 'right', width: COL.grade },
    )
    state.y = rowY - 1
  })

  // Bottom border.
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.y },
    thickness: 0.5,
    color: COLORS.border,
  })
  state.y -= LINE_HEIGHT
}

interface DrawCellOptions {
  align?: 'left' | 'right'
  width?: number
  bold?: boolean
  color?: typeof COLORS.text
}

function drawCell(
  state: RenderState,
  text: string,
  x: number,
  y: number,
  options: DrawCellOptions = {},
): void {
  const font = options.bold ? state.bold : state.font
  const color = options.color ?? COLORS.text
  const size = FONT_SIZE_BODY
  let drawX = x
  if (options.align === 'right' && options.width !== undefined) {
    const w = font.widthOfTextAtSize(text, size)
    drawX = x + options.width - w
  }
  state.page.drawText(text, { x: drawX, y, size, font, color })
}

function truncate(font: PDFFont, text: string, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, FONT_SIZE_BODY) <= maxWidth) {
    return text
  }
  let cut = text.length
  while (cut > 0 && font.widthOfTextAtSize(`${text.slice(0, cut)}…`, FONT_SIZE_BODY) > maxWidth) {
    cut -= 1
  }
  return cut > 0 ? `${text.slice(0, cut)}…` : '…'
}

// Per-subject assessment/exam detail block. Compact, grouped. Rendered
// only when a subject has any assessment or exam scores.
function subjectDetails(state: RenderState, subjects: SubjectResult[]): void {
  const withDetails = subjects.filter(
    (s) => s.assessmentScores.length > 0 || s.examScores.length > 0,
  )
  if (withDetails.length === 0) return
  paginate(state, LINE_HEIGHT * 4)
  title(state, 'Score breakdown', { size: FONT_SIZE_HEADER, bold: true, color: COLORS.accent })
  state.y -= 4
  for (const s of withDetails) {
    paginate(state, LINE_HEIGHT * 2)
    title(
      state,
      truncate(state.font, s.subjectName, CONTENT_WIDTH - 4),
      { size: FONT_SIZE_BODY, bold: true },
    )
    for (const a of s.assessmentScores) {
      paginate(state, LINE_HEIGHT)
      title(
        state,
        `  ${a.assessmentTypeName}: ${a.score} / ${a.maxScore}`,
        { size: FONT_SIZE_SMALL, color: COLORS.muted },
      )
    }
    for (const e of s.examScores) {
      paginate(state, LINE_HEIGHT)
      title(
        state,
        `  ${e.examName}: ${e.score} / ${e.maxScore}${e.grade ? ` (${e.grade})` : ''}`,
        { size: FONT_SIZE_SMALL, color: COLORS.muted },
      )
    }
    state.y -= 2
  }
  state.y -= LINE_HEIGHT
}

function remarks(
  state: RenderState,
  card: ReportCardDetail,
): void {
  const blocks: Array<[string, string | null]> = [
    ['Attendance summary', card.attendanceSummary],
    ['Teacher remark', card.teacherRemark],
    ['Principal remark', card.principalRemark],
  ]
  const present = blocks.filter(([, v]) => v && v.trim().length > 0)
  if (present.length === 0) return
  paginate(state, LINE_HEIGHT * 4)
  title(state, 'Remarks', { size: FONT_SIZE_HEADER, bold: true, color: COLORS.accent })
  state.y -= 4
  for (const [label, value] of present) {
    if (!value) continue
    paginate(state, LINE_HEIGHT * 2)
    title(state, label, { size: FONT_SIZE_BODY, bold: true })
    const wrapped = wrap(state.font, value, CONTENT_WIDTH - 10, FONT_SIZE_BODY)
    for (const line of wrapped) {
      paginate(state, LINE_HEIGHT)
      title(state, line, { size: FONT_SIZE_BODY, color: COLORS.muted })
    }
    state.y -= 2
  }
}

function wrap(
  font: PDFFont,
  text: string,
  maxWidth: number,
  size: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      // Hard-break very long single words.
      let chunk = w
      while (font.widthOfTextAtSize(chunk, size) > maxWidth && chunk.length > 1) {
        let cut = chunk.length
        while (cut > 1 && font.widthOfTextAtSize(chunk.slice(0, cut), size) > maxWidth) {
          cut -= 1
        }
        lines.push(chunk.slice(0, cut))
        chunk = chunk.slice(cut)
      }
      current = chunk
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Renders a report card as a PDF. The layout is A4 portrait with a
 * header, student block, subject results table, optional score
 * breakdown, remarks, and a status footer. Pages are added as needed.
 */
export async function renderReportCardPdf(
  card: ReportCardDetail,
): Promise<Uint8Array> {
  const state = await newRenderState()

  // Header.
  titleCentered(state, 'Report Card', {
    size: FONT_SIZE_TITLE,
    bold: true,
    color: COLORS.accent,
  })
  const sessionLine = [card.sessionName, card.termName].filter(Boolean).join(' — ')
  if (sessionLine) {
    titleCentered(state, sessionLine, {
      size: FONT_SIZE_HEADER,
      color: COLORS.muted,
    })
  }
  state.y -= 4
  rule(state)

  // Student block.
  title(state, card.studentName, { size: FONT_SIZE_HEADER, bold: true })
  const meta = [
    card.admissionNumber ? `Admission no: ${card.admissionNumber}` : null,
    card.className ? `Class: ${card.className}` : null,
    card.sectionName ? `Section: ${card.sectionName}` : null,
  ].filter(Boolean) as string[]
  if (meta.length > 0) {
    title(state, meta.join('   '), { size: FONT_SIZE_BODY, color: COLORS.muted })
  }
  state.y -= LINE_HEIGHT

  // Subject results table.
  subjectTable(state, card.subjectResults)

  // Totals.
  paginate(state, LINE_HEIGHT * 4)
  const totals: string[] = []
  if (card.totalScore !== null) totals.push(`Total: ${card.totalScore}`)
  if (card.averageScore !== null) totals.push(`Average: ${card.averageScore}%`)
  if (card.overallGrade) totals.push(`Overall grade: ${card.overallGrade}`)
  if (totals.length > 0) {
    title(state, totals.join('    '), { size: FONT_SIZE_HEADER, bold: true })
    state.y -= LINE_HEIGHT
  }

  // Score breakdown (assessment + exam details per subject).
  subjectDetails(state, card.subjectResults)

  // Remarks.
  remarks(state, card)

  // Footer.
  paginate(state, LINE_HEIGHT * 2)
  rule(state, 0.5)
  const generatedAt = card.publishedAt ?? card.updatedAt
  const footer = [
    `Status: ${card.status}`,
    generatedAt ? `Date: ${new Date(generatedAt).toLocaleDateString('en-GB')}` : null,
  ].filter(Boolean) as string[]
  title(state, footer.join('   '), {
    size: FONT_SIZE_SMALL,
    color: COLORS.muted,
  })

  return state.doc.save()
}

// Matches the 503 thrown by getR2Bucket when the R2_BUCKET binding is
// absent (plain Node dev). Anything else is a real failure and bubbles
// up to the caller.
function isStorageUnavailable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const status = (err as { statusCode?: unknown }).statusCode
  return status === 503
}

/**
 * Renders the report card PDF, writes it to R2, and persists the
 * resulting object key on the report card row. Swallows 503 from
 * `putObject` (plain Node dev has no R2 binding — the card stays
 * `objectKey = null` and the download endpoint returns 404). Any
 * other error (render failure, DB write failure, R2 server error)
 * is re-thrown so the route fails loudly.
 *
 * Used by the generate and publish route handlers so both paths
 * keep the PDF in sync with the persisted row.
 */
export async function storeReportCardPdf(
  event: H3Event,
  card: ReportCardDetail,
): Promise<void> {
  const objectKey = buildReportCardObjectKey(card)
  try {
    const bytes = await renderReportCardPdf(card)
    await putObject(event, objectKey, bytes, 'application/pdf')
    // Lazy import keeps the pure render function (and its tests) free
    // of the Drizzle/Postgres service chain.
    const { setReportCardObjectKey } = await import('../../services/exams')
    await setReportCardObjectKey(card.id, objectKey)
  } catch (err: unknown) {
    if (!isStorageUnavailable(err)) throw err
  }
}
