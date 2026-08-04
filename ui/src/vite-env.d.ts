/// <reference types="vite/client" />

interface ImportMeta {
  env: {
    DEV: boolean
    PROD: boolean
    MODE: string
  }
}

declare const __DEV__: boolean
