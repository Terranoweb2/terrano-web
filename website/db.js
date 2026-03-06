const Database = require('better-sqlite3')
const path = require('path')

let db = null

function initDb() {
  const dbPath = path.join(__dirname, 'portal.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  console.log('[DB] Portal database initialized')
}

function getDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}

function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get()
  const currentVersion = row?.v ?? 0

  const migrations = [
    {
      version: 1,
      sql: `
        CREATE TABLE web_accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX idx_web_accounts_username ON web_accounts(username);

        CREATE TABLE web_sessions (
          token TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES web_accounts(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE INDEX idx_sessions_account ON web_sessions(account_id);
        CREATE INDEX idx_sessions_expires ON web_sessions(expires_at);
      `
    },
    {
      version: 2,
      sql: `
        CREATE TABLE mail_messages (
          id TEXT PRIMARY KEY,
          from_id TEXT NOT NULL REFERENCES web_accounts(id) ON DELETE CASCADE,
          to_id TEXT NOT NULL REFERENCES web_accounts(id) ON DELETE CASCADE,
          subject TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          parent_id TEXT DEFAULT NULL,
          thread_id TEXT DEFAULT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          is_starred INTEGER NOT NULL DEFAULT 0,
          folder TEXT NOT NULL DEFAULT 'inbox',
          sender_folder TEXT NOT NULL DEFAULT 'sent',
          has_attachment INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER DEFAULT NULL
        );
        CREATE INDEX idx_mail_to_folder ON mail_messages(to_id, folder, created_at);
        CREATE INDEX idx_mail_from_folder ON mail_messages(from_id, sender_folder, created_at);
        CREATE INDEX idx_mail_thread ON mail_messages(thread_id, created_at);
        CREATE INDEX idx_mail_unread ON mail_messages(to_id, folder, is_read);
        CREATE INDEX idx_mail_starred ON mail_messages(to_id, is_starred);

        CREATE TABLE mail_attachments (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          data BLOB NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX idx_attach_message ON mail_attachments(message_id);

        CREATE TABLE mail_contacts (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL REFERENCES web_accounts(id) ON DELETE CASCADE,
          contact_id TEXT NOT NULL REFERENCES web_accounts(id) ON DELETE CASCADE,
          nickname TEXT DEFAULT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(owner_id, contact_id)
        );
        CREATE INDEX idx_contacts_owner ON mail_contacts(owner_id);
      `
    },
    {
      version: 3,
      sql: `
        ALTER TABLE mail_messages ADD COLUMN external_to TEXT DEFAULT NULL;
      `
    },
    {
      version: 4,
      sql: `
        ALTER TABLE mail_messages ADD COLUMN external_from TEXT DEFAULT NULL;
      `
    },
    {
      version: 5,
      sql: `
        ALTER TABLE web_accounts ADD COLUMN first_name TEXT DEFAULT NULL;
        ALTER TABLE web_accounts ADD COLUMN last_name TEXT DEFAULT NULL;
        ALTER TABLE web_accounts ADD COLUMN birth_date TEXT DEFAULT NULL;
        ALTER TABLE web_accounts ADD COLUMN gender TEXT DEFAULT NULL;
      `
    },
    {
      version: 6,
      sql: `
        CREATE TABLE IF NOT EXISTS login_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          success INTEGER NOT NULL DEFAULT 0,
          attempted_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username, attempted_at);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
      `
    }
  ]

  const insertVersion = db.prepare('INSERT INTO schema_version (version) VALUES (?)')

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        db.exec(migration.sql)
        insertVersion.run(migration.version)
      })()
    }
  }
}

module.exports = { initDb, getDb, closeDb }
