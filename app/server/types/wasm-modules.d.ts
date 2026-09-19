/**
 * Ambient type for the @jsquash codec wasm imports.
 *
 * The `jsquashWasmLoader` build hook (build/jsquash-wasm-loader.ts)
 * inlines the wasm as base64 in both the Nitro Worker build and
 * Vitest; the runtime default export is the raw wasm `Uint8Array`.
 * Consumers compile `new WebAssembly.Module(bytes)` in their own realm
 * before passing it to each codec's `init(module)` — a module
 * precompiled in another VM realm fails the glue's
 * `instanceof WebAssembly.Module` checks.
 */
declare module '*.wasm' {
  const wasmBytes: Uint8Array
  export default wasmBytes
}
