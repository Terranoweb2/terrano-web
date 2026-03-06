import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'data')
  fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, 'terrano.db')
  db = new Database(dbPath)

  // WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as
    | { v: number | null }
    | undefined
  const currentVersion = row?.v ?? 0

  const migrations: { version: number; sql: string }[] = [
    {
      version: 1,
      sql: `
        CREATE TABLE history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          favicon_url TEXT,
          visit_time INTEGER NOT NULL,
          visit_count INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX idx_history_visit_time ON history(visit_time DESC);
        CREATE INDEX idx_history_url ON history(url);

        CREATE VIRTUAL TABLE history_fts USING fts5(
          url, title, content=history, content_rowid=id
        );

        CREATE TRIGGER history_ai AFTER INSERT ON history BEGIN
          INSERT INTO history_fts(rowid, url, title) VALUES (new.id, new.url, new.title);
        END;
        CREATE TRIGGER history_ad AFTER DELETE ON history BEGIN
          INSERT INTO history_fts(history_fts, rowid, url, title) VALUES('delete', old.id, old.url, old.title);
        END;
        CREATE TRIGGER history_au AFTER UPDATE ON history BEGIN
          INSERT INTO history_fts(history_fts, rowid, url, title) VALUES('delete', old.id, old.url, old.title);
          INSERT INTO history_fts(rowid, url, title) VALUES (new.id, new.url, new.title);
        END;
      `
    },
    {
      version: 2,
      sql: `
        CREATE TABLE bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          url TEXT,
          is_folder INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_bookmarks_parent ON bookmarks(parent_id);
        CREATE INDEX idx_bookmarks_url ON bookmarks(url);

        -- Root folders
        INSERT INTO bookmarks (id, parent_id, title, is_folder, sort_order)
          VALUES (1, NULL, 'Bookmarks Bar', 1, 0);
        INSERT INTO bookmarks (id, parent_id, title, is_folder, sort_order)
          VALUES (2, NULL, 'Other Bookmarks', 1, 1);
      `
    },
    {
      version: 3,
      sql: `
        CREATE TABLE downloads (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          filename TEXT NOT NULL,
          save_path TEXT NOT NULL,
          total_bytes INTEGER NOT NULL DEFAULT 0,
          received_bytes INTEGER NOT NULL DEFAULT 0,
          state TEXT NOT NULL DEFAULT 'progressing',
          start_time INTEGER NOT NULL
        );
        CREATE INDEX idx_downloads_start_time ON downloads(start_time DESC);
      `
    },
    {
      version: 4,
      sql: `
        CREATE TABLE permissions (
          origin TEXT NOT NULL,
          permission TEXT NOT NULL,
          granted INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (origin, permission)
        );
      `
    },
    {
      version: 5,
      sql: `
        CREATE TABLE IF NOT EXISTS reading_list (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL DEFAULT '',
          favicon_url TEXT,
          added_at INTEGER NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_reading_list_added ON reading_list(added_at DESC);
      `
    },
    {
      version: 6,
      sql: `
        CREATE TABLE email_accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email_address TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `
    },
    {
      version: 7,
      sql: `
        CREATE TABLE email_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          special_use TEXT,
          UNIQUE(account_id, name)
        );
        CREATE INDEX idx_email_folders_account ON email_folders(account_id);

        CREATE TABLE email_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
          folder_id INTEGER NOT NULL REFERENCES email_folders(id) ON DELETE CASCADE,
          message_id TEXT,
          from_address TEXT,
          from_name TEXT,
          to_addresses TEXT,
          cc_addresses TEXT,
          subject TEXT NOT NULL DEFAULT '',
          body_text TEXT,
          body_html TEXT,
          snippet TEXT,
          date INTEGER NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          is_flagged INTEGER NOT NULL DEFAULT 0,
          has_attachments INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_email_msg_folder ON email_messages(folder_id, date DESC);
        CREATE INDEX idx_email_msg_account ON email_messages(account_id);

        CREATE TABLE email_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          size INTEGER NOT NULL DEFAULT 0,
          data BLOB
        );
        CREATE INDEX idx_email_att_message ON email_attachments(message_id);
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
