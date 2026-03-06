import { create } from 'zustand'
import type { AppSettings, ThemeMode, UpdateInfo } from '@shared/types'

interface SettingsStore {
  settings: AppSettings | null
  updateInfo: UpdateInfo | null
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<void>
  applyTheme: (theme: ThemeMode) => void
  // Update actions
  loadUpdateStatus: () => Promise<void>
  setUpdateInfo: (info: UpdateInfo) => void
  checkForUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  updateInfo: null,

  load: async () => {
    const settings = await window.terranoAPI.settings.get()
    set({ settings })
    get().applyTheme(settings.theme)
  },

  update: async (partial) => {
    await window.terranoAPI.settings.set(partial)
    const updated = { ...get().settings!, ...partial }
    set({ settings: updated })
    if (partial.theme) {
      get().applyTheme(partial.theme)
    }
  },

  applyTheme: (theme) => {
    let resolved: 'light' | 'dark' = 'light'
    if (theme === 'dark') {
      resolved = 'dark'
    } else if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.setAttribute('data-theme', resolved)
  },

  // --- Update ---
  loadUpdateStatus: async () => {
    const info = await window.terranoAPI.update.getStatus()
    set({ updateInfo: info })
  },

  setUpdateInfo: (info: UpdateInfo) => {
    set({ updateInfo: info })
  },

  checkForUpdate: async () => {
    await window.terranoAPI.update.check()
  },

  installUpdate: async () => {
    await window.terranoAPI.update.install()
  }
}))
