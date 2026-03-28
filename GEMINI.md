# GEMINI.md - Vs-book-app

This file provides context and instructions for the Vs-book-app project, a full-stack book management application.

## Project Overview
Vs-book-app is a personal book tracking system built with a React frontend and a Node.js/Express backend. It uses SQLite for data storage and supports features like book tracking (unread, reading, read), star ratings, timestamped notes, and series management. It also integrates with the Open Library API to automatically fetch book metadata.

### Tech Stack
- **Frontend:** React 18 (TypeScript), Vite, React Router v6, Axios, SCSS, Lucide Icons.
- **Backend:** Node.js (TypeScript), Express, SQLite (via `sqlite3` and `sqlite` wrapper).
- **Database:** SQLite (`books.db` at the root).
- **Architecture:** Monorepo with independent `backend/` and `frontend/` npm workspaces.

## Project Structure
- `backend/`: Express server, database logic, and API routes.
- `frontend/`: React application, styling, and API integration.
- `books.db`: The SQLite database file (created automatically on first run).
- `deploy.sh`: Shell script for deployment.
- `nginx-vs-book-app.conf`: Nginx configuration for serving the app.
- `vs-book-app.service`: Systemd service file for the backend.

## Building and Running

### Prerequisites
- Node.js (LTS version recommended)
- npm

### Installation
From the project root, run:
```bash
npm run install:all
```
This will install dependencies for both the backend and frontend.

### Development
To run both the backend and frontend concurrently with hot-reloading:
```bash
npm run dev
```
- **Backend:** Starts on `http://localhost:3000`
- **Frontend:** Starts on `http://localhost:5173` (Vite proxies `/api` to the backend).

### Production Build
To build the project for production:
```bash
npm run build
```
The frontend build will be in `frontend/dist/` and the backend build in `backend/dist/`.

## Development Conventions

### Backend
- **Database:** SQLite schema is defined in `backend/src/database.ts`. It uses a migration pattern that adds new columns to existing tables if they don't exist.
- **Error Handling:** Use the `asyncHandler.ts` wrapper for all async route handlers to ensure errors are caught and passed to the Express error middleware.
- **API Routes:** Organized by entity in `backend/src/routes/`.

### Frontend
- **Types:** Centralized in `frontend/src/types/index.ts`. Ensure any changes to the database schema are reflected here.
- **Styling:** Uses SASS (`.scss`) with variables for theming. Themes (`light`, `dark`, `purple`) are defined in `frontend/src/styles/_themes.scss` and applied via the `data-theme` attribute on the `<html>` element.
- **API Calls:** Handled via Axios in `frontend/src/api/index.ts`. All calls should use the base instance with the `/api` prefix.

### Metadata Integration
The app uses `frontend/src/api/openLibrary.ts` to search for and fetch book data from the Open Library API. This is used in the `BookForm` to auto-fill book details.

## Deployment
Deployment is typically handled via the `deploy.sh` script, which builds the project and restarts the `vs-book-app.service`. The app is served using Nginx as a reverse proxy.
