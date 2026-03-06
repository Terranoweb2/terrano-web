import { BUILTIN_BLOCKLIST } from './blocklist'

export class AdBlocker {
  private enabled = true
  private blockedDomains = new Set<string>()
  private blockCounts = new Map<string, number>()

  constructor() {
    for (const d of BUILTIN_BLOCKLIST) {
      this.blockedDomains.add(d)
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  shouldBlock(url: string): boolean {
    if (!this.enabled) return false
    try {
      const hostname = new URL(url).hostname
      return this.matchesDomain(hostname)
    } catch {
      return false
    }
  }

  private matchesDomain(hostname: string): boolean {
    if (this.blockedDomains.has(hostname)) return true
    const parts = hostname.split('.')
    for (let i = 1; i < parts.length - 1; i++) {
      if (this.blockedDomains.has(parts.slice(i).join('.'))) return true
    }
    return false
  }

  recordBlocked(tabId: string): void {
    this.blockCounts.set(tabId, (this.blockCounts.get(tabId) ?? 0) + 1)
  }

  getBlockedCount(tabId: string): number {
    return this.blockCounts.get(tabId) ?? 0
  }

  resetCount(tabId: string): void {
    this.blockCounts.delete(tabId)
  }
}
