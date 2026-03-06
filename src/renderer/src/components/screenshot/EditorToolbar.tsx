import { Pen, Type, Eraser, Crop, Undo2, Redo2, Save, Copy, X } from 'lucide-react'
import { useScreenshotStore } from '@renderer/stores/screenshot-store'
import type { AnnotationTool } from '@shared/types'
import styles from './EditorToolbar.module.css'

const TOOLS: { id: AnnotationTool; label: string; icon: typeof Pen }[] = [
  { id: 'pen', label: 'Stylo', icon: Pen },
  { id: 'text', label: 'Texte', icon: Type },
  { id: 'eraser', label: 'Gomme', icon: Eraser },
  { id: 'crop', label: 'Recadrer', icon: Crop }
]

const PEN_COLORS = ['#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff', '#9900ff', '#000000', '#ffffff']

interface EditorToolbarProps {
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onCopy: () => void
  onClose: () => void
}

export function EditorToolbar({
  onUndo,
  onRedo,
  onSave,
  onCopy,
  onClose
}: EditorToolbarProps): JSX.Element {
  const activeTool = useScreenshotStore((s) => s.activeTool)
  const setActiveTool = useScreenshotStore((s) => s.setActiveTool)
  const penColor = useScreenshotStore((s) => s.penColor)
  const setPenColor = useScreenshotStore((s) => s.setPenColor)
  const penSize = useScreenshotStore((s) => s.penSize)
  const setPenSize = useScreenshotStore((s) => s.setPenSize)
  const eraserSize = useScreenshotStore((s) => s.eraserSize)
  const setEraserSize = useScreenshotStore((s) => s.setEraserSize)
  const fontSize = useScreenshotStore((s) => s.fontSize)
  const setFontSize = useScreenshotStore((s) => s.setFontSize)
  const canUndo = useScreenshotStore((s) => s.canUndo)
  const canRedo = useScreenshotStore((s) => s.canRedo)

  return (
    <div className={styles.toolbar}>
      {/* Tool buttons */}
      <div className={styles.group}>
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.toolBtn} ${activeTool === id ? styles.active : ''}`}
            onClick={() => setActiveTool(id)}
            title={label}
          >
            <Icon size={16} />
            <span className={styles.toolLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.sep} />

      {/* Tool options */}
      <div className={styles.group}>
        {(activeTool === 'pen' || activeTool === 'text') && (
          <>
            {/* Color picker */}
            <div className={styles.colors}>
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${penColor === c ? styles.activeColor : ''}`}
                  style={{ background: c }}
                  onClick={() => setPenColor(c)}
                  title={c}
                />
              ))}
            </div>

            {/* Size slider */}
            {activeTool === 'pen' && (
              <div className={styles.sizeControl}>
                <span className={styles.sizeLabel}>{penSize}px</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={penSize}
                  onChange={(e) => setPenSize(Number(e.target.value))}
                  className={styles.slider}
                />
              </div>
            )}

            {activeTool === 'text' && (
              <div className={styles.sizeControl}>
                <span className={styles.sizeLabel}>{fontSize}px</span>
                <input
                  type="range"
                  min={10}
                  max={72}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className={styles.slider}
                />
              </div>
            )}
          </>
        )}

        {activeTool === 'eraser' && (
          <div className={styles.sizeControl}>
            <span className={styles.sizeLabel}>{eraserSize}px</span>
            <input
              type="range"
              min={5}
              max={60}
              value={eraserSize}
              onChange={(e) => setEraserSize(Number(e.target.value))}
              className={styles.slider}
            />
          </div>
        )}
      </div>

      <div className={styles.spacer} />

      {/* Actions */}
      <div className={styles.group}>
        <button
          className={styles.actionBtn}
          onClick={onUndo}
          disabled={!canUndo()}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className={styles.actionBtn}
          onClick={onRedo}
          disabled={!canRedo()}
          title="Retablir (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        <div className={styles.sep} />

        <button className={styles.saveBtn} onClick={onSave} title="Enregistrer (Ctrl+S)">
          <Save size={16} />
          <span>Enregistrer</span>
        </button>
        <button className={styles.copyBtn} onClick={onCopy} title="Copier (Ctrl+C)">
          <Copy size={16} />
          <span>Copier</span>
        </button>
        <button className={styles.closeBtn} onClick={onClose} title="Fermer (Echap)">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
