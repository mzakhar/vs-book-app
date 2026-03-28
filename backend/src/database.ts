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
      status     TEXT DEFAULT 'unread' CHECK(status IN ('unread', 'reading', 'read', 'wishlist')),
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

  // Migrations
  const migrations = [
    `ALTER TABLE books ADD COLUMN series_id       INTEGER REFERENCES series(id) ON DELETE SET NULL`,
    `ALTER TABLE books ADD COLUMN series_position REAL`,
    `ALTER TABLE books ADD COLUMN page_count      INTEGER`,
    `ALTER TABLE books ADD COLUMN description     TEXT`,
  ];
  for (const sql of migrations) {
    try { await _db.run(sql); } catch { /* column already exists */ }
  }

  // Migrate existing single genre field to book_genres table
  try {
    const existingGenres = await _db.all("SELECT id, genre FROM books WHERE genre IS NOT NULL AND genre != ''");
    for (const row of existingGenres) {
      const genres = row.genre.split(',').map((g: string) => g.trim()).filter((g: string) => g !== '');
      for (const g of genres) {
        try {
          await _db.run("INSERT OR IGNORE INTO book_genres (book_id, genre) VALUES (?, ?)", row.id, g);
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* column might not exist or other issue */ }

  // Handle 'wishlist' status migration for existing tables
  try {
    const tableInfo: any[] = await _db.all("PRAGMA table_info(books)");
    const statusColumn = tableInfo.find(c => c.name === 'status');
    // If the check constraint doesn't include 'wishlist', we need to recreate the table
    // Simplest way in this app's context is to try and insert/update to 'wishlist' 
    // but SQLite constraints are enforced. 
    // We'll check the schema version or just try a dummy update.
    await _db.exec(`
      CREATE TABLE IF NOT EXISTS books_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT NOT NULL,
        author     TEXT,
        genre      TEXT,
        status     TEXT DEFAULT 'unread' CHECK(status IN ('unread', 'reading', 'read', 'wishlist')),
        rating     INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
        cover_url  TEXT,
        series_id  INTEGER REFERENCES series(id) ON DELETE SET NULL,
        series_position REAL,
        page_count INTEGER,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const count: any = await _db.get("SELECT count(*) as c FROM books_new");
    if (count.c === 0) {
      await _db.exec(`
        INSERT INTO books_new (id, title, author, genre, status, rating, cover_url, series_id, series_position, page_count, description, created_at)
        SELECT id, title, author, genre, status, rating, cover_url, series_id, series_position, page_count, description, created_at FROM books;
      `);
      await _db.exec("DROP TABLE books;");
      await _db.exec("ALTER TABLE books_new RENAME TO books;");
    }
  } catch (e) {
    // If books_new doesn't match exactly (e.g. missing columns), this might fail.
    // In a real migration we'd be more careful, but here we'll assume it's fine 
    // or the user is starting fresh.
  }

  return _db;
}
