import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  _db = await open({
    filename: path.join(__dirname, '../../books.db'),
    driver: sqlite3.Database,
  });

  await _db.exec('PRAGMA journal_mode = WAL');
  await _db.exec('PRAGMA foreign_keys = ON');

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      author     TEXT,
      genre      TEXT,
      status     TEXT DEFAULT 'unread' CHECK(status IN ('unread', 'reading', 'read')),
      rating     INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
      cover_url  TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return _db;
}
