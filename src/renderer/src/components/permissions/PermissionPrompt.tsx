import { useState, useEffect } from 'react'
import { Shield, Check, X } from 'lucide-react'
import styles from './PermissionPrompt.module.css'

interface PermissionRequest {
  requestId: string
  origin: string
  permission: string
}

const PERMISSION_LABELS: Record<string, string> = {
  'media': 'camera and microphone',
  'geolocation': 'your location',
  'notifications': 'show notifications',
  'midi': 'MIDI devices',
  'pointerLock': 'lock your pointer',
  'fullscreen': 'enter fullscreen',
  'display-capture': 'share your screen',
  'mediaKeySystem': 'play protected content'
}

export function PermissionPrompt() {
  const [request, setRequest] = useState<PermissionRequest | null>(null)

  useEffect(() => {
    const cleanup = window.terranoAPI.permissions.onRequest(
      (requestId, origin, permission) => {
        setRequest({
          requestId: requestId as string,
          origin: origin as string,
          permission: permission as string
        })
      }
    )
    return cleanup
  }, [])

  if (!request) return null

  const label = PERMISSION_LABELS[request.permission] || request.permission

  function respond(granted: boolean) {
    if (!request) return
    window.terranoAPI.permissions.respond(request.requestId, granted)
    setRequest(null)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.prompt}>
        <div className={styles.icon}>
          <Shield size={20} />
        </div>
        <div className={styles.info}>
          <div className={styles.title}>
            <strong>{request.origin}</strong> wants to access {label}
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.denyBtn} onClick={() => respond(false)}>
            <X size={14} />
            Block
          </button>
          <button className={styles.allowBtn} onClick={() => respond(true)}>
            <Check size={14} />
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
