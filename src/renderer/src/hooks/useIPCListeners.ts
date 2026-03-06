import { useEffect } from 'react'
import { useTabStore } from '@renderer/stores/tab-store'
import { useNavStore } from '@renderer/stores/nav-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { AppSettings, UpdateInfo } from '@shared/types'

export function useIPCListeners() {
  const setTabs = useTabStore((s) => s.setTabs)
  const addTab = useTabStore((s) => s.addTab)
  const removeTab = useTabStore((s) => s.removeTab)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const updateTab = useTabStore((s) => s.updateTab)
  const updateNavState = useNavStore((s) => s.updateState)
  const updateZoomLevel = useNavStore((s) => s.updateZoomLevel)
  const applyTheme = useSettingsStore((s) => s.applyTheme)
  const setUpdateInfo = useSettingsStore((s) => s.setUpdateInfo)

  useEffect(() => {
    // Fetch initial tabs
    window.terranoAPI.tabs.getAll().then(setTabs)

    // Tab events
    const cleanups = [
      window.terranoAPI.tabs.onCreated(addTab),
      window.terranoAPI.tabs.onClosed(removeTab),
      window.terranoAPI.tabs.onActivated(setActiveTab),
      window.terranoAPI.tabs.onUpdated(updateTab),
      // Navigation events
      window.terranoAPI.nav.onStateChanged((tabId, state) => {
        updateNavState(tabId as string, state as never)
      }),
      // Settings events
      window.terranoAPI.settings.onChanged((settings) => {
        const s = settings as AppSettings
        applyTheme(s.theme)
      }),
      // Zoom events
      window.terranoAPI.nav.onZoomChanged((tabId, level) => {
        updateZoomLevel(tabId as string, level as number)
      }),
      // Update events
      window.terranoAPI.update.onStatusChanged((info) => {
        setUpdateInfo(info as UpdateInfo)
      })
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [setTabs, addTab, removeTab, setActiveTab, updateTab, updateNavState, updateZoomLevel, applyTheme, setUpdateInfo])
}
