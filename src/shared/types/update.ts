export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateInfo {
  currentVersion: string
  status: UpdateStatus
  availableVersion: string | null
  releaseNotes: string | null
  downloadProgress: number
  errorMessage: string | null
}
