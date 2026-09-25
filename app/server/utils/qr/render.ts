/**
 * QR rendering helpers (Phase 15).
 *
 * Uses the pure-JS `qrcode/lib/browser.js` entry (no fs/canvas/pngjs)
 * so the same code runs in the Worker and in Vitest:
 * - `renderQrSvg` → SVG string for browser routes.
 * - `qrMatrix` → module bit matrix for the pdf-lib receipt embed
 *   (drawn as vector rectangles — no PNG encoding needed in Workers).
 */
import { create, toString } from 'qrcode/lib/browser.js'

export interface QrMatrix {
  /** Symbol width/height in modules. */
  size: number
  isDark(row: number, col: number): boolean
}

/** Synchronous module matrix for the vector PDF embed. */
export function qrMatrix(text: string): QrMatrix {
  const qr = create(text, { errorCorrectionLevel: 'M' })
  const { modules } = qr
  return {
    size: modules.size,
    isDark: (row, col) => modules.get(row, col) === 1,
  }
}

/** SVG string for browser `<img>` routes. */
export async function renderQrSvg(text: string, width = 192): Promise<string> {
  return toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width,
  })
}
