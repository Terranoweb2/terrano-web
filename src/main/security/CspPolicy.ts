import { session } from 'electron'
import type { AdBlocker } from './AdBlocker'

/** Resource types that are sub-resources (safe to block for ad-blocking).
 *  Navigations (mainFrame, subFrame) are NEVER blocked to avoid ERR_BLOCKED_BY_CLIENT
 *  on redirect chains (e.g. ad tracking URLs like amazon-adsystem.com). */
const BLOCKABLE_RESOURCE_TYPES = new Set([
  'script',
  'stylesheet',
  'image',
  'font',
  'xhr',
  'media',
  'webSocket',
  'ping',
  'other',
  'object',
  'cspReport'
])

export function setupNavigationGuards(
  adBlocker?: AdBlocker,
  callbacks?: {
    onNavigationBlocked?: (url: string) => void
    onAdBlocked?: (tabId: string, count: number) => void
    getTabIdByWebContentsId?: (webContentsId: number) => string | null
  }
): void {
  // Block dangerous protocols globally
  const blockedProtocols = ['javascript:', 'vbscript:', 'data:text/html']

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.toLowerCase()

    // Block dangerous protocols
    for (const blocked of blockedProtocols) {
      if (url.startsWith(blocked)) {
        callbacks?.onNavigationBlocked?.(details.url)
        callback({ cancel: true })
        return
      }
    }

    // Ad blocker — whitelist approach: only block sub-resource types
    if (
      adBlocker &&
      details.webContentsId !== undefined &&
      BLOCKABLE_RESOURCE_TYPES.has(details.resourceType) &&
      adBlocker.shouldBlock(details.url)
    ) {
      const tabId = callbacks?.getTabIdByWebContentsId?.(details.webContentsId)
      if (tabId) {
        adBlocker.recordBlocked(tabId)
        callbacks?.onAdBlocked?.(tabId, adBlocker.getBlockedCount(tabId))
      }
      callback({ cancel: true })
      return
    }

    callback({})
  })
}
