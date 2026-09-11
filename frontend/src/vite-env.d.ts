/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the versioned API, proxied in development. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
