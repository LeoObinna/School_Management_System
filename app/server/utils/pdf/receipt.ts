/**
 * Branded payment receipt PDF renderer (Phase 15).
 *
 * Pure function: takes plain receipt data and returns PDF bytes. No
 * I/O, no event, no R2 — the service layer stores the result and
 * persists the object key (same pattern as report-card.ts).
 *
 * Branding is settings-driven (school name/motto/colors, bank details).
 * Standard pdf-lib fonts only encode Latin-1, so amounts render as
 * `NGN 150,000.00` — never the ₦ glyph, which would throw.
 */
import {
  PDFDocument,
  StandardFonts,
  PageSizes,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { SchoolSettings } from '../../../shared/types'
import { buildReceiptQrPayload } from '../qr/payload'
import { qrMatrix } from '../qr/render'

const PAGE = PageSizes.A4
const MARGIN = 50
const CONTENT_WIDTH = PAGE[0] - MARGIN * 2

const FONT_SIZE_TITLE = 20
const FONT_SIZE_HEADER = 13
const FONT_SIZE_BODY = 10
const FONT_SIZE_SMALL = 9
const LINE_HEIGHT = 16
const TABLE_ROW_HEIGHT = 18

// Items table column widths (sum = 495 ≈ CONTENT_WIDTH).
const COL = {
  description: 245,
  qty: 50,
  unit: 100,
  total: 100,
} as const

export interface ReceiptItemLine {
  description: string
  quantity: number
  unitAmount: number
  lineTotal: number
}

export interface ReceiptData {
  receiptNumber: string
  issuedAt: string
  paymentReference: string
  providerReference: string | null
  method: string
  /** Amount of THIS payment, kobo. */
  amount: number
  paidAt: string | null
  studentName: string
  admissionNumber: string | null
  className: string | null
  invoiceNumber: string
  sessionName: string
  termName: string | null
  items: ReceiptItemLine[]
  invoiceTotal: number
  invoiceAmountPaid: number
  invoiceBalance: number
}

/** Deterministic R2 key — regeneration overwrites the same object. */
export function buildReceiptObjectKey(receiptNumber: string): string {
  const safe = receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '')
  return `receipts/${safe}.pdf`
}

/** '#1a237e' → rgb(...) for pdf-lib; falls back to navy on bad input. */
export function parseHexColor(
  hex: string,
): ReturnType<typeof rgb> {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return rgb(0.102, 0.137, 0.494)
  const n = parseInt(m[1]!, 16)
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255)
}

/** ASCII-safe money for standard PDF fonts: `NGN 150,000.00`. */
export function formatReceiptMoney(kobo: number): string {
  const sign = kobo < 0 ? '-' : ''
  const abs = Math.abs(kobo)
  const whole = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}NGN ${grouped}.${fraction}`
}

interface RenderState {
  doc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
  italic: PDFFont
  accent: ReturnType<typeof rgb>
}

const MUTED = rgb(0.4, 0.4, 0.4)
const BORDER = rgb(0.7, 0.7, 0.7)
const ZEBRA = rgb(0.96, 0.96, 0.97)

async function newRenderState(primaryColor: string): Promise<RenderState> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const page = doc.addPage(PAGE)
  return {
    doc,
    page,
    font,
    bold,
    italic,
    accent: parseHexColor(primaryColor),
    y: PAGE[1] - MARGIN,
  }
}

function paginate(state: RenderState, needed: number): void {
  if (state.y - needed < MARGIN + 30) {
    state.page = state.doc.addPage(PAGE)
    state.y = PAGE[1] - MARGIN
  }
}

function line(
  state: RenderState,
  text: string,
  options: {
    size?: number
    font?: PDFFont
    color?: ReturnType<typeof rgb>
    x?: number
  } = {},
): void {
  const size = options.size ?? FONT_SIZE_BODY
  state.page.drawText(text, {
    x: options.x ?? MARGIN,
    y: state.y - size,
    size,
    font: options.font ?? state.font,
    color: options.color ?? rgb(0.1, 0.1, 0.1),
  })
  state.y -= size + 6
}

function centered(
  state: RenderState,
  text: string,
  options: {
    size?: number
    font?: PDFFont
    color?: ReturnType<typeof rgb>
  } = {},
): void {
  const size = options.size ?? FONT_SIZE_BODY
  const font = options.font ?? state.font
  const width = font.widthOfTextAtSize(text, size)
  state.page.drawText(text, {
    x: MARGIN + (CONTENT_WIDTH - width) / 2,
    y: state.y - size,
    size,
    font,
    color: options.color ?? rgb(0.1, 0.1, 0.1),
  })
  state.y -= size + 6
}

function rule(state: RenderState): void {
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.y },
    thickness: 0.5,
    color: BORDER,
  })
  state.y -= 8
}

function truncate(font: PDFFont, text: string, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, FONT_SIZE_BODY) <= maxWidth) return text
  let cut = text.length
  while (cut > 0 && font.widthOfTextAtSize(`${text.slice(0, cut)}...`, FONT_SIZE_BODY) > maxWidth) {
    cut -= 1
  }
  return cut > 0 ? `${text.slice(0, cut)}...` : '...'
}

function drawCell(
  state: RenderState,
  text: string,
  x: number,
  y: number,
  options: { align?: 'left' | 'right'; width?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
): void {
  const font = options.bold ? state.bold : state.font
  let drawX = x
  if (options.align === 'right' && options.width !== undefined) {
    drawX = x + options.width - font.widthOfTextAtSize(text, FONT_SIZE_BODY)
  }
  state.page.drawText(text, {
    x: drawX,
    y,
    size: FONT_SIZE_BODY,
    font,
    color: options.color ?? rgb(0.1, 0.1, 0.1),
  })
}

function itemsTable(state: RenderState, items: ReceiptItemLine[]): void {
  if (items.length === 0) return
  // Header row.
  const headerY = state.y - TABLE_ROW_HEIGHT
  state.page.drawRectangle({
    x: MARGIN,
    y: headerY,
    width: CONTENT_WIDTH,
    height: TABLE_ROW_HEIGHT,
    color: state.accent,
  })
  const white = rgb(1, 1, 1)
  drawCell(state, 'Fee purpose', MARGIN + 4, headerY + 5, { bold: true, color: white })
  drawCell(state, 'Qty', MARGIN + COL.description, headerY + 5, { bold: true, align: 'right', width: COL.qty - 4, color: white })
  drawCell(state, 'Unit', MARGIN + COL.description + COL.qty, headerY + 5, { bold: true, align: 'right', width: COL.unit - 4, color: white })
  drawCell(state, 'Amount', MARGIN + COL.description + COL.qty + COL.unit, headerY + 5, { bold: true, align: 'right', width: COL.total - 4, color: white })
  state.y = headerY - 2

  items.forEach((item, i) => {
    paginate(state, TABLE_ROW_HEIGHT + LINE_HEIGHT)
    const rowY = state.y - TABLE_ROW_HEIGHT
    if (i % 2 === 1) {
      state.page.drawRectangle({
        x: MARGIN,
        y: rowY,
        width: CONTENT_WIDTH,
        height: TABLE_ROW_HEIGHT,
        color: ZEBRA,
      })
    }
    drawCell(state, truncate(state.font, item.description, COL.description - 8), MARGIN + 4, rowY + 5)
    drawCell(state, String(item.quantity), MARGIN + COL.description, rowY + 5, { align: 'right', width: COL.qty - 4 })
    drawCell(state, formatReceiptMoney(item.unitAmount), MARGIN + COL.description + COL.qty, rowY + 5, { align: 'right', width: COL.unit - 4 })
    drawCell(state, formatReceiptMoney(item.lineTotal), MARGIN + COL.description + COL.qty + COL.unit, rowY + 5, { align: 'right', width: COL.total - 4 })
    state.y = rowY - 1
  })

  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.y },
    thickness: 0.5,
    color: BORDER,
  })
  state.y -= LINE_HEIGHT
}

// Label: value pair right-aligned block (totals).
function totalsRow(state: RenderState, label: string, value: string, bold = false): void {
  paginate(state, LINE_HEIGHT)
  const x = MARGIN + CONTENT_WIDTH - 250
  state.page.drawText(label, {
    x,
    y: state.y - FONT_SIZE_BODY,
    size: FONT_SIZE_BODY,
    font: bold ? state.bold : state.font,
    color: MUTED,
  })
  const vWidth = (bold ? state.bold : state.font).widthOfTextAtSize(value, FONT_SIZE_BODY)
  state.page.drawText(value, {
    x: MARGIN + CONTENT_WIDTH - vWidth,
    y: state.y - FONT_SIZE_BODY,
    size: FONT_SIZE_BODY,
    font: bold ? state.bold : state.font,
  })
  state.y -= LINE_HEIGHT
}

/**
 * Renders an official payment receipt. `bank` is included only when the
 * school has populated its bank details in settings.
 */
export async function renderReceiptPdf(
  data: ReceiptData,
  settings: SchoolSettings,
): Promise<Uint8Array> {
  const state = await newRenderState(settings.primaryColor || '#1a237e')

  // --- School header -------------------------------------------------
  centered(state, settings.name.toUpperCase(), {
    size: FONT_SIZE_TITLE,
    font: state.bold,
    color: state.accent,
  })
  if (settings.motto) {
    centered(state, settings.motto, { size: FONT_SIZE_SMALL, font: state.italic, color: MUTED })
  }
  const contact = [settings.address, settings.email, settings.phone]
    .filter(Boolean)
    .join('  ·  ')
  if (contact) {
    centered(state, truncate(state.font, contact, CONTENT_WIDTH), {
      size: FONT_SIZE_SMALL,
      color: MUTED,
    })
  }
  state.y -= 6
  rule(state)

  centered(state, 'OFFICIAL PAYMENT RECEIPT', {
    size: FONT_SIZE_HEADER,
    font: state.bold,
  })
  state.y -= 4

  // --- Receipt meta ----------------------------------------------------
  line(state, `Receipt no: ${data.receiptNumber}`, { font: state.bold })
  line(state, `Payment reference: ${data.paymentReference}`)
  if (data.providerReference) {
    line(state, `Gateway reference: ${data.providerReference}`, { size: FONT_SIZE_SMALL, color: MUTED })
  }
  line(
    state,
    `Date paid: ${data.paidAt ? new Date(data.paidAt).toLocaleDateString('en-GB') : '—'}`,
  )

  // --- Student / invoice block ------------------------------------------
  state.y -= 4
  line(state, `Received from: ${data.studentName}`, { font: state.bold })
  const studentMeta = [
    data.admissionNumber ? `Admission no: ${data.admissionNumber}` : null,
    data.className ? `Class: ${data.className}` : null,
  ].filter(Boolean) as string[]
  if (studentMeta.length > 0) {
    line(state, studentMeta.join('    '), { color: MUTED })
  }
  line(
    state,
    `Invoice: ${data.invoiceNumber}   (${[data.sessionName, data.termName].filter(Boolean).join(' — ')})`,
    { color: MUTED },
  )
  state.y -= LINE_HEIGHT

  // --- Fee purposes ------------------------------------------------------
  itemsTable(state, data.items)

  // --- Totals ------------------------------------------------------------
  totalsRow(state, 'Invoice total', formatReceiptMoney(data.invoiceTotal))
  totalsRow(state, 'This payment', formatReceiptMoney(data.amount), true)
  totalsRow(state, 'Paid to date', formatReceiptMoney(data.invoiceAmountPaid))
  totalsRow(state, 'Balance', formatReceiptMoney(data.invoiceBalance), true)
  state.y -= LINE_HEIGHT

  // --- Payment method -----------------------------------------------------
  line(state, `Payment method: ${data.method.replaceAll('_', ' ')}`, {
    color: MUTED,
  })

  // --- Bank details (only when configured) --------------------------------
  if (settings.bankName && settings.accountNumber) {
    paginate(state, LINE_HEIGHT * 4)
    rule(state)
    line(state, 'School bank details', { font: state.bold, size: FONT_SIZE_BODY })
    line(
      state,
      `Bank: ${settings.bankName}   Account name: ${settings.accountName || settings.name}   Account no: ${settings.accountNumber}`,
      { size: FONT_SIZE_SMALL, color: MUTED },
    )
  }

  // --- Verification QR (vector modules — no PNG needed in Workers) -----
  // Embedded payload carries receipt/payment references + amount so the
  // document can be checked against the records by scanning it.
  const QR_SIZE = 72
  paginate(state, QR_SIZE + LINE_HEIGHT * 2)
  const matrix = qrMatrix(buildReceiptQrPayload(data))
  const qrX = MARGIN + CONTENT_WIDTH - QR_SIZE
  const qrBottom = state.y - QR_SIZE
  const cell = QR_SIZE / matrix.size
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.isDark(r, c)) {
        state.page.drawRectangle({
          x: qrX + c * cell,
          y: qrBottom + (matrix.size - 1 - r) * cell,
          width: cell,
          height: cell,
          color: rgb(0, 0, 0),
        })
      }
    }
  }
  const caption = 'Scan to verify this receipt'
  const captionWidth = state.font.widthOfTextAtSize(caption, FONT_SIZE_SMALL)
  state.page.drawText(caption, {
    x: qrX + (QR_SIZE - captionWidth) / 2,
    y: qrBottom - FONT_SIZE_SMALL - 2,
    size: FONT_SIZE_SMALL,
    font: state.font,
    color: MUTED,
  })
  state.y = qrBottom - FONT_SIZE_SMALL - 2 - LINE_HEIGHT

  // --- Footer --------------------------------------------------------------
  paginate(state, LINE_HEIGHT * 3)
  rule(state)
  line(
    state,
    `Issued ${new Date(data.issuedAt).toLocaleDateString('en-GB')} · This receipt was generated electronically and is valid without a signature.`,
    { size: FONT_SIZE_SMALL, color: MUTED },
  )

  return state.doc.save()
}
