/// <reference types="vite/client" />

import type { TerranoAPI } from '../../preload/ui-preload'

declare global {
  interface Window {
    terranoAPI: TerranoAPI
  }
}
