import { create } from 'zustand'
import type { NavigationState } from '@shared/types'

interface NavStore {
  // Per-tab navigation state, keyed by tabId
  states: Record<string, NavigationState>
  zoomLevels: Record<string, number>

  updateState: (tabId: string, state: NavigationState) => void
  removeState: (tabId: string) => void
  updateZoomLevel: (tabId: string, level: number) => void

  // User actions
  navigate: (tabId: string, url: string) => Promise<void>
  goBack: (tabId: string) => Promise<void>
  goForward: (tabId: string) => Promise<void>
  reload: (tabId: string) => Promise<void>
  stop: (tabId: string) => Promise<void>
}

export const useNavStore = create<NavStore>((set) => ({
  states: {},
  zoomLevels: {},

  updateState: (tabId, state) =>
    set((prev) => ({
      states: { ...prev.states, [tabId]: state }
    })),

  removeState: (tabId) =>
    set((prev) => {
      const { [tabId]: _, ...rest } = prev.states
      return { states: rest }
    }),

  updateZoomLevel: (tabId, level) =>
    set((prev) => ({
      zoomLevels: { ...prev.zoomLevels, [tabId]: level }
    })),

  navigate: async (tabId, url) => {
    await window.terranoAPI.nav.navigate({ tabId, url })
  },

  goBack: async (tabId) => {
    await window.terranoAPI.nav.goBack(tabId)
  },

  goForward: async (tabId) => {
    await window.terranoAPI.nav.goForward(tabId)
  },

  reload: async (tabId) => {
    await window.terranoAPI.nav.reload(tabId)
  },

  stop: async (tabId) => {
    await window.terranoAPI.nav.stop(tabId)
  }
}))
