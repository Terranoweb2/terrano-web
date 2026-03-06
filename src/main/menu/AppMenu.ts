import { Menu, globalShortcut, type BaseWindow } from 'electron'
import type { TabManager } from '../tabs/TabManager'
import type { NavigationController } from '../navigation/NavigationController'
import type { ViewManager } from '../window/ViewManager'

interface ShortcutDeps {
  window: BaseWindow
  tabManager: TabManager
  navController: NavigationController
  viewManager: ViewManager
}

export function registerKeyboardShortcuts(deps: ShortcutDeps): void {
  const { window, tabManager, navController, viewManager } = deps

  // Build application menu with accelerators
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => tabManager.createTab()
        },
        {
          label: 'New Private Tab',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => tabManager.createTab({ private: true })
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) tabManager.closeTab(id)
          }
        },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => tabManager.reopenClosedTab()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'F5',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) navController.reload(id)
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) navController.reload(id)
          }
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) {
              const wc = tabManager.getTabWebContents(id)
              wc?.reloadIgnoringCache()
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) {
              const wc = tabManager.getTabWebContents(id)
              if (wc) {
                wc.setZoomLevel(wc.getZoomLevel() + 0.5)
                viewManager.uiWebContents.send('nav:on-zoom-changed', id, wc.getZoomLevel())
              }
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) {
              const wc = tabManager.getTabWebContents(id)
              if (wc) {
                wc.setZoomLevel(wc.getZoomLevel() - 0.5)
                viewManager.uiWebContents.send('nav:on-zoom-changed', id, wc.getZoomLevel())
              }
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) {
              const wc = tabManager.getTabWebContents(id)
              if (wc) {
                wc.setZoomLevel(0)
                viewManager.uiWebContents.send('nav:on-zoom-changed', id, wc.getZoomLevel())
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Find in Page',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            viewManager.uiWebContents.send('open-find')
          }
        },
        {
          label: 'Capture Page',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            viewManager.uiWebContents.send('capture-page')
          }
        },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            window.setFullScreen(!window.isFullScreen())
          }
        },
        { type: 'separator' },
        {
          label: 'Developer Tools (UI)',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => viewManager.uiWebContents.toggleDevTools()
        },
        {
          label: 'Developer Tools (Page)',
          accelerator: 'F12',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) {
              const wc = tabManager.getTabWebContents(id)
              wc?.toggleDevTools()
            }
          }
        }
      ]
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Focus Address Bar',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            viewManager.uiWebContents.send('focus-omnibox')
          }
        },
        {
          label: 'Go Back',
          accelerator: 'Alt+Left',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) navController.goBack(id)
          }
        },
        {
          label: 'Go Forward',
          accelerator: 'Alt+Right',
          click: () => {
            const id = tabManager.getActiveTabId()
            if (id) navController.goForward(id)
          }
        },
        { type: 'separator' },
        {
          label: 'Next Tab',
          accelerator: 'CmdOrCtrl+Tab',
          click: () => switchTab(tabManager, 1)
        },
        {
          label: 'Previous Tab',
          accelerator: 'CmdOrCtrl+Shift+Tab',
          click: () => switchTab(tabManager, -1)
        }
      ]
    }
  ])

  Menu.setApplicationMenu(menu)
}

function switchTab(tabManager: TabManager, direction: number): void {
  const tabs = tabManager.getAllTabs()
  const activeId = tabManager.getActiveTabId()
  if (!activeId || tabs.length <= 1) return

  const idx = tabs.findIndex((t) => t.id === activeId)
  const nextIdx = (idx + direction + tabs.length) % tabs.length
  tabManager.activateTab(tabs[nextIdx].id)
}
