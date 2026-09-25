/**
 * Ambient types for the Workers-safe qrcode entry.
 *
 * The package's main entry (`qrcode/lib/index.js`) requires Node `fs`;
 * the browser entry is pure JS (SVG string + module matrix only), which
 * is what the Worker bundles. `@types/qrcode` only covers the main
 * specifier, and `export * from` is not usable inside an ambient module
 * declaration, so the two functions we use are declared explicitly with
 * types imported from the main package.
 */
declare module 'qrcode/lib/browser.js' {
  import type { QRCode, QRCodeOptions, QRCodeToStringOptions } from 'qrcode'

  export function create(
    text: string,
    options?: QRCodeOptions,
  ): QRCode

  export function toString(
    text: string,
    options?: QRCodeToStringOptions,
  ): Promise<string>
}
