# V's Book App

A single-user book management app for tracking your reading list, built with Express, SQLite, React, and Vite.

## Features

- Add, edit, and delete books (title, author, genre, status, rating, cover)
- Search books by title or author
- Track reading status — **Unread**, **Reading**, **Read**
- 1–5 star ratings
- Multiple timestamped notes per book, with edit and delete

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Backend  | Express, SQLite (via `sqlite3`)   |
| Frontend | React 18, React Router, Axios     |
| Styling  | SASS (dark + light themes)        |
| Icons    | Lucide React                      |
| Tooling  | Vite, TypeScript, nodemon, ts-node |

## Getting Started

```bash
# Install all dependencies
npm run install:all

# Start backend (port 3000) + frontend (port 5173) concurrently
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Project Structure

```
Vs-book-app/
├── package.json          # root: concurrently scripts
├── backend/
│   ├── src/
│   │   ├── index.ts      # Express entry point
│   │   ├── database.ts   # SQLite schema & init
│   │   ├── asyncHandler.ts
│   │   └── routes/
│   │       ├── books.ts  # CRUD + search
│   │       └── notes.ts  # notes per book
└── frontend/
    └── src/
        ├── pages/
        │   ├── BookList.tsx    # library grid + search
        │   └── BookDetail.tsx  # book + notes
        ├── components/
        │   ├── BookForm.tsx
        │   ├── NoteForm.tsx
        │   ├── Modal.tsx
        │   └── Toast.tsx
        └── styles/             # SASS with dark/light themes
```

## API

| Method | Endpoint            | Description              |
|--------|---------------------|--------------------------|
| GET    | `/api/books`        | List books (`?q=` search)|
| POST   | `/api/books`        | Create book              |
| GET    | `/api/books/:id`    | Get book                 |
| PUT    | `/api/books/:id`    | Update book              |
| DELETE | `/api/books/:id`    | Delete book + notes      |
| GET    | `/api/notes/:bookId`| List notes for a book    |
| POST   | `/api/notes/:bookId`| Add note                 |
| PUT    | `/api/notes/:noteId`| Edit note                |
| DELETE | `/api/notes/:noteId`| Delete note              |
