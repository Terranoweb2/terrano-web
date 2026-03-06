import { useEffect } from 'react'
import { TitleBar } from './components/titlebar/TitleBar'
import { TabBar } from './components/tabs/TabBar'
import { Toolbar } from './components/toolbar/Toolbar'
import { Sidebar } from './components/sidebar/Sidebar'
import { LoadingBar } from './components/ui/LoadingBar'
import { FindBar } from './components/ui/FindBar'
import { PermissionPrompt } from './components/permissions/PermissionPrompt'
import { ScreenshotOverlay } from './components/screenshot/ScreenshotOverlay'
import { useIPCListeners } from './hooks/useIPCListeners'
import { useSettingsStore } from './stores/settings-store'
import styles from './App.module.css'

export default function App() {
  useIPCListeners()

  const loadSettings = useSettingsStore((s) => s.load)
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className={styles.app}>
      <TitleBar />
      <TabBar />
      <Toolbar />
      <LoadingBar />
      <FindBar />
      <PermissionPrompt />
      {/* Tab content area is managed by main process WebContentsView */}
      <div className={styles.contentArea}>
        <Sidebar />
      </div>
      <ScreenshotOverlay />
    </div>
  )
}
