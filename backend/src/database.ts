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

  // 1. Create tables with IF NOT EXISTS
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS series (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      total_books INTEGER,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS books (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      author     TEXT,
      genre      TEXT,
      status     TEXT DEFAULT 'unread',
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

    CREATE TABLE IF NOT EXISTS book_genres (
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      genre      TEXT NOT NULL,
      PRIMARY KEY (book_id, genre)
    );
  `);

  // 2. Run migrations for columns
  const migrations = [
    `ALTER TABLE books ADD COLUMN series_id       INTEGER REFERENCES series(id) ON DELETE SET NULL`,
    `ALTER TABLE books ADD COLUMN series_position REAL`,
    `ALTER TABLE books ADD COLUMN page_count      INTEGER`,
    `ALTER TABLE books ADD COLUMN description     TEXT`,
  ];
  for (const sql of migrations) {
    try { await _db.run(sql); } catch { /* column already exists */ }
  }

  // 3. Migrate existing genre data to book_genres if book_genres is empty
  try {
    const rowCount: any = await _db.get("SELECT COUNT(*) as c FROM book_genres");
    if (rowCount && rowCount.c === 0) {
      const existingGenres = await _db.all("SELECT id, genre FROM books WHERE genre IS NOT NULL AND genre != ''");
      for (const row of existingGenres) {
        const genres = row.genre.split(',').map((g: string) => g.trim()).filter((g: string) => g !== '');
        for (const g of genres) {
          try {
            await _db.run("INSERT OR IGNORE INTO book_genres (book_id, genre) VALUES (?, ?)", row.id, g);
          } catch (e) { /* ignore */ }
        }
      }
    }
  } catch (e) {
    console.error("Genre migration failed:", e);
  }

  return _db;
}
