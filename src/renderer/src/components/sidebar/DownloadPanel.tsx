import { useState, useEffect } from 'react'
import { FileDown, FolderOpen, X as CancelIcon, Download } from 'lucide-react'
import type { DownloadItem } from '@shared/types'
import styles from './Sidebar.module.css'

export function DownloadPanel() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  useEffect(() => {
    load()

    const cleanups = [
      window.terranoAPI.downloads.onStarted((item) => {
        setDownloads((prev) => [item as DownloadItem, ...prev])
      }),
      window.terranoAPI.downloads.onProgress((item) => {
        setDownloads((prev) =>
          prev.map((d) => (d.id === (item as DownloadItem).id ? (item as DownloadItem) : d))
        )
      }),
      window.terranoAPI.downloads.onCompleted((item) => {
        setDownloads((prev) =>
          prev.map((d) => (d.id === (item as DownloadItem).id ? (item as DownloadItem) : d))
        )
      })
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [])

  async function load() {
    const items = await window.terranoAPI.downloads.getAll()
    setDownloads(items)
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  function getStatusText(item: DownloadItem): string {
    switch (item.state) {
      case 'progressing': {
        const pct = item.totalBytes > 0
          ? Math.round((item.receivedBytes / item.totalBytes) * 100)
          : 0
        return `${formatBytes(item.receivedBytes)} / ${formatBytes(item.totalBytes)} (${pct}%)`
      }
      case 'completed':
        return `${formatBytes(item.totalBytes)} — Completed`
      case 'cancelled':
        return 'Cancelled'
      case 'interrupted':
        return 'Interrupted'
    }
  }

  return (
    <>
      {downloads.length === 0 ? (
        <div className={styles.emptyState}>
          <Download size={32} />
          <span>No downloads yet</span>
        </div>
      ) : (
        downloads.map((item) => (
          <div key={item.id} className={styles.item}>
            <span className={styles.itemIcon}>
              <FileDown size={16} />
            </span>
            <div className={styles.itemInfo}>
              <div className={styles.itemTitle}>{item.filename}</div>
              <div className={styles.itemSubtitle}>{getStatusText(item)}</div>
              {item.state === 'progressing' && item.totalBytes > 0 && (
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${(item.receivedBytes / item.totalBytes) * 100}%` }}
                  />
                </div>
              )}
            </div>
            {item.state === 'progressing' ? (
              <button
                className={styles.itemAction}
                onClick={() => window.terranoAPI.downloads.cancel(item.id)}
                aria-label="Cancel"
              >
                <CancelIcon size={14} />
              </button>
            ) : item.state === 'completed' ? (
              <button
                className={styles.itemAction}
                style={{ opacity: 1 }}
                onClick={() => window.terranoAPI.downloads.showInFolder(item.id)}
                aria-label="Show in folder"
              >
                <FolderOpen size={14} />
              </button>
            ) : null}
          </div>
        ))
      )}
    </>
  )
}
