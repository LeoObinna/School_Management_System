/**
 * Build-time loader for the @jsquash WASM image codecs (Phase 12 Part C
 * / Option C — gallery thumbnails).
 *
 * Why a custom hook:
 * - The Worker build (Nitro → Rollup) and tests (Vitest/Vite) both need
 *   `import mod from '@jsquash/.../codec.wasm'` to resolve to a ready
 *   `WebAssembly.Module`.
 * - Vite's built-in `vite:wasm-helper` uses *filtered* load hooks that
 *   take precedence over ordinary user-plugin hooks and emit glue that
 *   tries to satisfy the codecs' `env`/`wasi` imports itself (and fails
 *   on emscripten modules). So we claim the specifier earlier, in a
 *   `pre` resolveId hook, rewriting the id with a private `?sms-wasm`
 *   suffix which Vite's wasm filters do not match; our own `load` hook
 *   then returns plain JS exporting the base64-inlined wasm bytes as a
 *   `Uint8Array` (consumers compile them in their own realm —
 *   precompiled modules do not survive cross-realm `instanceof`
 *   checks in the codecs' glue under Vitest's per-file environments).
 * - Plain Rollup (Nitro) has no wasm handling at all, and accepts the
 *   same resolveId/load pair unchanged.
 *
 * The resulting chunk needs no special wrangler rules and works
 * identically in Node/Vitest and workerd; codec modules are only pulled
 * into the lazy thumbnail chunk (dynamic import).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const JSQUASH_WASM = /[\\/]node_modules[\\/]@jsquash[\\/].*\.wasm$/
const SUFFIX = '?sms-wasm'

export interface JsquashWasmLoaderPlugin {
  name: string
  enforce: 'pre'
  resolveId(source: string, importer?: string): string | null
  load(id: string): string | null
}

export function jsquashWasmLoader(): JsquashWasmLoaderPlugin {
  // Bare-specifier resolution from the importing module (works for
  // package subpaths — the @jsquash packages ship no "exports" map).
  const resolveFrom = (importer: string, source: string): string | null => {
    try {
      const base = importer.split('?')[0]!
      const requireFrom = createRequire(
        base.startsWith('file:') ? base : pathToFileURL(base),
      )
      return requireFrom.resolve(source)
    } catch {
      return null
    }
  }

  return {
    name: 'sms:jsquash-wasm-module',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.endsWith('.wasm')) return null
      const resolved = resolveFrom(importer, source)
      if (!resolved || !JSQUASH_WASM.test(resolved)) return null
      return `${resolved}${SUFFIX}`
    },
    load(id) {
      if (!id.endsWith(SUFFIX)) return null
      const path = id.slice(0, -SUFFIX.length)
      if (!JSQUASH_WASM.test(path)) return null
      const base64 = readFileSync(path).toString('base64')
      return [
        '// Raw wasm bytes (base64-inlined at build time). Consumers',
        '// compile these into a WebAssembly.Module in THEIR OWN realm',
        '// just before init() — a precompiled module shared across',
        '// VM realms (e.g. Vitest per-file jsdom environments) fails',
        '// the glue\u2019s `instanceof WebAssembly.Module` checks.',
        'export default Uint8Array.from(',
        `  atob(${JSON.stringify(base64)}),`,
        '  (ch) => ch.charCodeAt(0),',
        ')',
      ].join('\n')
    },
  }
}
