import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      psp TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('approved','declined','pending','timeout','error')),
      response_time_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_psp_created ON transactions(psp, created_at);
    CREATE INDEX IF NOT EXISTS idx_status_created ON transactions(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_payment_method ON transactions(payment_method, created_at);
    CREATE INDEX IF NOT EXISTS idx_created ON transactions(created_at);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
