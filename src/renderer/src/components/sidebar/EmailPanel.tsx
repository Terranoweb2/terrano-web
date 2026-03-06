import { useState, useEffect } from 'react'
import {
  Inbox,
  Send,
  FileEdit,
  Trash2,
  AlertTriangle,
  Plus,
  LogOut,
  ArrowLeft,
  Star,
  Reply,
  Paperclip,
  SendHorizonal,
  ChevronLeft,
  ExternalLink
} from 'lucide-react'
import { useEmailStore } from '@renderer/stores/email-store'
import type { CreateAccountOptions, EmailFolder, ComposeEmail } from '@shared/types'
import styles from './EmailPanel.module.css'

const SIGNUP_URL = 'https://terranoweb.win/register'

const FOLDER_ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileEdit,
  trash: Trash2,
  junk: AlertTriangle
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ---- Login View ----
function LoginView() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setActiveAccount = useEmailStore((s) => s.setActiveAccount)
  const setView = useEmailStore((s) => s.setView)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const account = await window.terranoAPI.email.login(username.trim(), password)
      if (account) {
        await setActiveAccount(account)
      } else {
        setError('Identifiants incorrects')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.authForm} onSubmit={handleLogin}>
      <div className={styles.authTitle}>Connexion</div>
      <div className={styles.authSubtitle}>Connectez-vous a votre boite @terranoweb.win</div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nom d'utilisateur</label>
        <input
          className={styles.fieldInput}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="utilisateur"
          autoFocus
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Mot de passe</label>
        <input
          className={styles.fieldInput}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.primaryBtn} type="submit" disabled={loading || !username || !password}>
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
      <button
        type="button"
        className={styles.linkBtn}
        onClick={() => window.terranoAPI.tabs.create({ url: SIGNUP_URL, active: true })}
      >
        Creer un compte sur terranoweb.win
      </button>
    </form>
  )
}

// ---- Create Account View ----
// La creation de compte se fait sur la page officielle terranoweb.win
function CreateAccountView() {
  const setView = useEmailStore((s) => s.setView)
  const accounts = useEmailStore((s) => s.accounts)

  function openSignupPage() {
    window.terranoAPI.tabs.create({ url: SIGNUP_URL, active: true })
  }

  return (
    <div className={styles.authForm}>
      <div className={styles.authTitle}>Nouveau compte</div>
      <div className={styles.authSubtitle}>
        Creez votre adresse @terranoweb.win sur notre page officielle
      </div>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          <img
            src="https://terranoweb.win/favicon.png"
            alt="TerranoWeb"
            style={{ width: 64, height: 64, borderRadius: 12 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
          La creation de compte se fait directement sur le site officiel TerranoWeb.
          Une fois votre compte cree, revenez ici pour vous connecter.
        </p>
      </div>
      <button className={styles.primaryBtn} type="button" onClick={openSignupPage}>
        <ExternalLink size={16} style={{ marginRight: 6 }} />
        Creer un compte sur terranoweb.win
      </button>
      {accounts.length > 0 && (
        <button type="button" className={styles.linkBtn} onClick={() => setView('login')}>
          J'ai deja un compte
        </button>
      )}
    </div>
  )
}

// ---- Folder Sidebar ----
function FolderListView() {
  const folders = useEmailStore((s) => s.folders)
  const activeFolder = useEmailStore((s) => s.activeFolder)
  const selectFolder = useEmailStore((s) => s.selectFolder)
  const setView = useEmailStore((s) => s.setView)
  const activeAccount = useEmailStore((s) => s.activeAccount)
  const logout = useEmailStore((s) => s.logout)
  const unreadCount = useEmailStore((s) => s.unreadCount)

  return (
    <>
      {activeAccount && (
        <div className={styles.accountHeader}>
          <div className={styles.avatar}>
            {activeAccount.displayName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.accountInfo}>
            <div className={styles.accountName}>{activeAccount.displayName}</div>
            <div className={styles.accountEmail}>{activeAccount.emailAddress}</div>
          </div>
          <button className={styles.logoutBtn} onClick={logout} title="Deconnexion">
            <LogOut size={14} />
          </button>
        </div>
      )}

      <button className={styles.composeBtn} onClick={() => setView('compose')}>
        <Plus size={16} />
        Nouveau message
      </button>

      <div className={styles.folderList}>
        {folders.map((folder) => {
          const Icon = FOLDER_ICONS[folder.specialUse ?? ''] ?? Inbox
          const isActive = activeFolder?.id === folder.id
          const badge = folder.specialUse === 'inbox' ? unreadCount : 0
          return (
            <div
              key={folder.id}
              className={`${styles.folderItem} ${isActive ? styles.folderItemActive : ''}`}
              onClick={() => selectFolder(folder)}
            >
              <Icon size={16} className={styles.folderIcon} />
              <span className={styles.folderName}>{folder.name}</span>
              {badge > 0 && <span className={styles.folderBadge}>{badge}</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ---- Message List ----
function MessageListView() {
  const messages = useEmailStore((s) => s.messages)
  const selectMessage = useEmailStore((s) => s.selectMessage)
  const activeFolder = useEmailStore((s) => s.activeFolder)
  const toggleFlagged = useEmailStore((s) => s.toggleFlagged)

  if (messages.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Aucun message dans {activeFolder?.name ?? 'ce dossier'}
      </div>
    )
  }

  return (
    <div className={styles.messageList}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`${styles.messageItem} ${!msg.isRead ? styles.messageUnread : ''}`}
          onClick={() => selectMessage(msg)}
        >
          <div className={styles.messageRow}>
            <span className={styles.messageSender}>
              {msg.fromName || msg.fromAddress || 'Inconnu'}
            </span>
            {msg.isFlagged && <Star size={12} className={styles.flagIcon} fill="currentColor" />}
            {msg.hasAttachments && <Paperclip size={12} className={styles.attachIcon} />}
            <span className={styles.messageDate}>{formatDate(msg.date)}</span>
          </div>
          <div className={styles.messageSubject}>{msg.subject || '(sans sujet)'}</div>
          {msg.snippet && <div className={styles.messageSnippet}>{msg.snippet}</div>}
        </div>
      ))}
    </div>
  )
}

// ---- Message View ----
function MessageDetailView() {
  const activeMessage = useEmailStore((s) => s.activeMessage)
  const setView = useEmailStore((s) => s.setView)
  const deleteMessage = useEmailStore((s) => s.deleteMessage)
  const toggleFlagged = useEmailStore((s) => s.toggleFlagged)
  const selectFolder = useEmailStore((s) => s.selectFolder)
  const activeFolder = useEmailStore((s) => s.activeFolder)

  if (!activeMessage) return null

  function goBack() {
    if (activeFolder) {
      setView('messages')
    }
  }

  return (
    <div className={styles.messageView}>
      <button className={styles.backBtn} onClick={goBack}>
        <ChevronLeft size={16} />
        Retour
      </button>
      <div className={styles.messageViewHeader}>
        <div className={styles.messageViewSubject}>{activeMessage.subject || '(sans sujet)'}</div>
        <div className={styles.messageViewMeta}>
          <span className={styles.messageViewFrom}>
            {activeMessage.fromName || activeMessage.fromAddress || 'Inconnu'}
          </span>
          {activeMessage.fromName && activeMessage.fromAddress && (
            <span>&lt;{activeMessage.fromAddress}&gt;</span>
          )}
          <span style={{ marginLeft: 'auto' }}>{formatDate(activeMessage.date)}</span>
        </div>
      </div>
      <div className={styles.messageViewActions}>
        <button
          className={styles.actionBtn}
          onClick={() => toggleFlagged(activeMessage.id, !activeMessage.isFlagged)}
          title={activeMessage.isFlagged ? 'Retirer le suivi' : 'Suivre'}
        >
          <Star size={14} fill={activeMessage.isFlagged ? 'currentColor' : 'none'} />
        </button>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
          onClick={() => deleteMessage(activeMessage.id)}
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className={styles.messageViewBody}>
        {activeMessage.bodyText ?? activeMessage.bodyHtml?.replace(/<[^>]*>/g, '') ?? ''}
      </div>
    </div>
  )
}

// ---- Compose View ----
function ComposeView() {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const activeAccount = useEmailStore((s) => s.activeAccount)
  const setView = useEmailStore((s) => s.setView)
  const activeFolder = useEmailStore((s) => s.activeFolder)
  const selectFolder = useEmailStore((s) => s.selectFolder)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!activeAccount || !to.trim()) return
    setError('')
    setSending(true)
    try {
      const email: ComposeEmail = {
        accountId: activeAccount.id,
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: subject.trim(),
        body: body,
        isHtml: false
      }
      await window.terranoAPI.email.send(email)
      // Go back to messages
      if (activeFolder) {
        await selectFolder(activeFolder)
      }
      setView('messages')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <form className={styles.composeForm} onSubmit={handleSend}>
      <button type="button" className={styles.backBtn} onClick={() => setView('messages')}>
        <ChevronLeft size={16} />
        Annuler
      </button>
      <div className={styles.composeFields}>
        <div className={styles.composeField}>
          <span className={styles.composeFieldLabel}>De</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }}>
            {activeAccount?.emailAddress}
          </span>
        </div>
        <div className={styles.composeField}>
          <label className={styles.composeFieldLabel}>A</label>
          <input
            className={styles.composeFieldInput}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="destinataire@exemple.com"
            autoFocus
          />
        </div>
        <div className={styles.composeField}>
          <label className={styles.composeFieldLabel}>Objet</label>
          <input
            className={styles.composeFieldInput}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet du message"
          />
        </div>
      </div>
      <textarea
        className={styles.composeBody}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Redigez votre message..."
      />
      {error && <div className={styles.error} style={{ padding: '0 16px' }}>{error}</div>}
      <div className={styles.composeActions}>
        <button className={styles.sendBtn} type="submit" disabled={sending || !to.trim()}>
          <SendHorizonal size={16} />
          {sending ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </form>
  )
}

// ---- Main EmailPanel ----
export function EmailPanel() {
  const view = useEmailStore((s) => s.view)
  const loadAccounts = useEmailStore((s) => s.loadAccounts)
  const activeAccount = useEmailStore((s) => s.activeAccount)
  const refreshUnreadCount = useEmailStore((s) => s.refreshUnreadCount)

  useEffect(() => {
    loadAccounts()
  }, [])

  // Listen for new messages
  useEffect(() => {
    if (!activeAccount) return
    const cleanup = window.terranoAPI.email.onNewMessage((accountId) => {
      if (accountId === activeAccount.id) {
        refreshUnreadCount()
        // Refresh the current folder messages
        const folder = useEmailStore.getState().activeFolder
        if (folder) {
          window.terranoAPI.email.getMessages(activeAccount.id, folder.id).then((msgs) => {
            useEmailStore.setState({ messages: msgs })
          })
        }
      }
    })
    return cleanup
  }, [activeAccount?.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {view === 'login' && <LoginView />}
      {view === 'create-account' && <CreateAccountView />}
      {(view === 'folders' || view === 'messages') && (
        <>
          <FolderListView />
          <MessageListView />
        </>
      )}
      {view === 'message' && (
        <>
          <MessageDetailView />
        </>
      )}
      {view === 'compose' && <ComposeView />}
    </div>
  )
}
