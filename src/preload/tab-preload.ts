// Minimal preload for web page tabs — expose almost nothing for security
// Web pages should NOT have access to any IPC or Electron APIs
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('terrano', {
  platform: process.platform
})
