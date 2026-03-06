import { create } from 'zustand'
import type { TabState, CreateTabOptions } from '@shared/types'

interface TabStore {
  tabs: TabState[]
  activeTabId: string | null

  // Actions driven by IPC events from main
  setTabs: (tabs: TabState[]) => void
  addTab: (tab: TabState) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTab: (tab: TabState) => void

  // User actions (call IPC)
  createTab: (opts?: CreateTabOptions) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  activateTab: (tabId: string) => Promise<void>
  pinTab: (tabId: string) => Promise<void>
  unpinTab: (tabId: string) => Promise<void>
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  setTabs: (tabs) => {
    const active = tabs.find((t) => t.isActive)
    set({ tabs, activeTabId: active?.id ?? null })
  },

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.isActive ? tab.id : state.activeTabId
    })),

  removeTab: (tabId) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id !== tabId),
      activeTabId: state.activeTabId === tabId ? state.tabs[0]?.id ?? null : state.activeTabId
    })),

  setActiveTab: (tabId) =>
    set((state) => ({
      activeTabId: tabId,
      tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === tabId }))
    })),

  updateTab: (tab) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tab.id ? tab : t))
    })),

  createTab: async (opts) => {
    await window.terranoAPI.tabs.create(opts)
  },

  closeTab: async (tabId) => {
    await window.terranoAPI.tabs.close(tabId)
  },

  activateTab: async (tabId) => {
    await window.terranoAPI.tabs.activate(tabId)
  },

  pinTab: async (tabId) => {
    await window.terranoAPI.tabs.pin(tabId)
  },

  unpinTab: async (tabId) => {
    await window.terranoAPI.tabs.unpin(tabId)
  }
}))
