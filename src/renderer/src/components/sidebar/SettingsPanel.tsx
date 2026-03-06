import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { RefreshCw } from 'lucide-react'
import type { ThemeMode } from '@shared/types'
import styles from './Sidebar.module.css'
import settingsStyles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const settings = useSettingsStore((s) => s.settings)
  const load = useSettingsStore((s) => s.load)
  const update = useSettingsStore((s) => s.update)
  const updateInfo = useSettingsStore((s) => s.updateInfo)
  const loadUpdateStatus = useSettingsStore((s) => s.loadUpdateStatus)
  const checkForUpdate = useSettingsStore((s) => s.checkForUpdate)
  const installUpdate = useSettingsStore((s) => s.installUpdate)

  useEffect(() => {
    load()
    loadUpdateStatus()
  }, [load, loadUpdateStatus])

  if (!settings) return null

  // Derive display text from update status
  const statusText = (() => {
    if (!updateInfo) return ''
    switch (updateInfo.status) {
      case 'idle':
        return `Version ${updateInfo.currentVersion}`
      case 'checking':
        return 'Recherche de mises a jour...'
      case 'not-available':
        return `TerranoWeb est a jour (v${updateInfo.currentVersion})`
      case 'available':
        return `Mise a jour v${updateInfo.availableVersion} disponible`
      case 'downloading':
        return `Telechargement... ${updateInfo.downloadProgress}%`
      case 'downloaded':
        return `Mise a jour v${updateInfo.availableVersion} prete !`
      case 'error':
        return `Erreur: ${updateInfo.errorMessage}`
      default:
        return ''
    }
  })()

  const isChecking = updateInfo?.status === 'checking'

  return (
    <div className={settingsStyles.settings}>
      {/* About / Update section */}
      <div className={settingsStyles.group}>
        <label className={settingsStyles.label}>A propos de TerranoWeb</label>
        <div className={settingsStyles.updateSection}>
          <span className={settingsStyles.updateStatus}>{statusText}</span>

          {/* Progress bar during download */}
          {updateInfo?.status === 'downloading' && (
            <div className={settingsStyles.progressBar}>
              <div
                className={settingsStyles.progressFill}
                style={{ width: `${updateInfo.downloadProgress}%` }}
              />
            </div>
          )}

          {/* Restart button when update is downloaded */}
          {updateInfo?.status === 'downloaded' && (
            <button className={settingsStyles.updateBtn} onClick={installUpdate}>
              Redemarrer pour mettre a jour
            </button>
          )}

          {/* Check button when idle, up-to-date, or error */}
          {(updateInfo?.status === 'idle' ||
            updateInfo?.status === 'not-available' ||
            updateInfo?.status === 'error') && (
            <button
              className={settingsStyles.checkBtn}
              onClick={checkForUpdate}
              disabled={isChecking}
            >
              <RefreshCw size={12} />
              Rechercher des mises a jour
            </button>
          )}
        </div>
      </div>

      <div className={settingsStyles.group}>
        <label className={settingsStyles.label}>Thème</label>
        <select
          className={settingsStyles.select}
          value={settings.theme}
          onChange={(e) => update({ theme: e.target.value as ThemeMode })}
        >
          <option value="system">Système</option>
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>

      <div className={settingsStyles.group}>
        <label className={settingsStyles.label}>Moteur de recherche</label>
        <input
          className={settingsStyles.input}
          value={settings.searchEngine}
          onChange={(e) => update({ searchEngine: e.target.value })}
          placeholder="https://terranoweb.win/search?q="
          spellCheck={false}
        />
      </div>

      <div className={settingsStyles.group}>
        <label className={settingsStyles.label}>Page de démarrage</label>
        <input
          className={settingsStyles.input}
          value={settings.startupUrl}
          onChange={(e) => update({ startupUrl: e.target.value })}
          placeholder="https://www.google.com"
          spellCheck={false}
        />
      </div>

      <div className={settingsStyles.group}>
        <label className={settingsStyles.checkbox}>
          <input
            type="checkbox"
            checked={settings.restoreSession}
            onChange={(e) => update({ restoreSession: e.target.checked })}
          />
          <span>Restaurer les onglets ouverts au démarrage</span>
        </label>
      </div>

      <div className={settingsStyles.group}>
        <label className={settingsStyles.checkbox}>
          <input
            type="checkbox"
            checked={settings.adBlockerEnabled}
            onChange={(e) => update({ adBlockerEnabled: e.target.checked })}
          />
          <span>Activer le bloqueur de publicités</span>
        </label>
      </div>

      <div className={settingsStyles.group}>
        <label className={settingsStyles.label}>Dossier de téléchargement</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className={settingsStyles.input}
            style={{ flex: 1 }}
            value={settings.downloadPath}
            readOnly
            title={settings.downloadPath}
          />
          <button
            className={settingsStyles.pickBtn}
            onClick={async () => {
              const path = await window.terranoAPI.settings.pickDownloadPath()
              if (path) update({ downloadPath: path })
            }}
          >
            Parcourir
          </button>
        </div>
      </div>
    </div>
  )
}
