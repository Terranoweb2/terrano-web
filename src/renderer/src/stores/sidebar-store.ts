import { create } from 'zustand'

const SIDEBAR_WIDTH = 320 // Doit correspondre à --sidebar-width dans globals.css

export type SidebarPanel = 'history' | 'bookmarks' | 'downloads' | 'readingList' | 'settings' | 'email' | null

interface SidebarStore {
  activePanel: SidebarPanel
  toggle: (panel: SidebarPanel) => void
  close: () => void
}

/** Notifie le main process pour redimensionner le TabView */
function notifyMainProcess(isOpen: boolean): void {
  window.terranoAPI?.sidebar?.setState(isOpen ? SIDEBAR_WIDTH : 0)
}

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  activePanel: null,

  toggle: (panel) => {
    const isClosing = get().activePanel === panel
    set({ activePanel: isClosing ? null : panel })
    notifyMainProcess(!isClosing)
  },

  close: () => {
    set({ activePanel: null })
    notifyMainProcess(false)
  }
}))
