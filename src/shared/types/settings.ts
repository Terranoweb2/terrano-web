export type ThemeMode = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: ThemeMode
  searchEngine: string
  downloadPath: string
  startupUrl: string
  restoreSession: boolean
  adBlockerEnabled: boolean
}
