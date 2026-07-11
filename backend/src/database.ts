import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';

let _db: Database | null = null;

function getDatabasePath(): string {
  return process.env.DB_PATH || path.join(__dirname, '../../books.db');
}

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const dbPath = getDatabasePath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  _db = await open({
    filename: dbPath,
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

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Run migrations for columns
  const migrations = [
    `ALTER TABLE books ADD COLUMN series_id       INTEGER REFERENCES series(id) ON DELETE SET NULL`,
    `ALTER TABLE books ADD COLUMN series_position REAL`,
    `ALTER TABLE books ADD COLUMN page_count      INTEGER`,
    `ALTER TABLE books ADD COLUMN description     TEXT`,
    `ALTER TABLE books  ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE series ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
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

  // 4. Rebuild series table with a composite UNIQUE(user_id, name) constraint (once).
  // Sentinel: does a UNIQUE index exist on `name` alone (old schema)? If so, rebuild.
  const seriesIndexes: any[] = await _db.all(`PRAGMA index_list('series')`);
  let needsRebuild = false;
  for (const idx of seriesIndexes) {
    if (!idx.unique) continue;
    const cols: any[] = await _db.all(`PRAGMA index_info('${idx.name}')`);
    const colNames = cols.map((c: any) => c.name);
    if (colNames.length === 1 && colNames[0] === 'name') {
      needsRebuild = true;
    }
  }
  if (needsRebuild) {
    await _db.exec('PRAGMA foreign_keys = OFF');
    try {
      await _db.exec('BEGIN TRANSACTION');
      await _db.exec(`
        CREATE TABLE series_new (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL,
          total_books INTEGER,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, name)
        );
      `);
      await _db.exec(`
        INSERT INTO series_new (id, name, total_books, created_at, user_id)
        SELECT id, name, total_books, created_at, user_id FROM series;
      `);
      await _db.exec('DROP TABLE series');
      await _db.exec('ALTER TABLE series_new RENAME TO series');
      await _db.exec('COMMIT');
    } catch (e) {
      await _db.exec('ROLLBACK');
      throw e;
    } finally {
      await _db.exec('PRAGMA foreign_keys = ON');
    }
  }

  // 5. Seed admin user if none exist
  const userCount: any = await _db.get('SELECT COUNT(*) as c FROM users');
  if (userCount && userCount.c === 0) {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminUsername && adminPassword) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await _db.run(
        `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`,
        adminUsername, hash
      );
    } else {
      console.warn('no users exist and ADMIN_USERNAME/ADMIN_PASSWORD not set — nobody can log in');
    }
  }

  // 6. Backfill ownership of pre-existing books/series to the first admin
  const admin: any = await _db.get(`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`);
  if (admin) {
    await _db.run(`UPDATE books SET user_id = ? WHERE user_id IS NULL`, admin.id);
    await _db.run(`UPDATE series SET user_id = ? WHERE user_id IS NULL`, admin.id);
  }

  return _db;
}
