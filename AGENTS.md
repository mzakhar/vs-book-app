# Repository Guidelines

## Project Structure & Module Organization
`backend/` contains the Express + SQLite API. Server code lives in `backend/src/`, with route handlers in `backend/src/routes/` and build output in `backend/dist/`. `frontend/` contains the React + Vite client. Keep views in `frontend/src/pages/`, shared UI in `frontend/src/components/`, API helpers in `frontend/src/api/`, shared types in `frontend/src/types/`, and SASS partials in `frontend/src/styles/`. Root files such as `package.json`, `deploy.sh`, `nginx-vs-book-app.conf`, and `vs-book-app.service` support orchestration and deployment.

## Build, Test, and Development Commands
Run `npm run install:all` from the repo root to install both packages. Use `npm run dev` to start the backend and frontend together; `npm run dev:backend` and `npm run dev:frontend` run them separately. Build production assets with `npm run build`, which compiles the Vite frontend and TypeScript backend. For quick production checks, use `cd frontend && npm run preview` or `cd backend && npm start`.

## Coding Style & Naming Conventions
Use TypeScript throughout and follow the existing 2-space indentation style. Name React components and page files in PascalCase (`BookDetail.tsx`, `Toast.tsx`), utility and route modules in camelCase or lower-case (`openLibrary.ts`, `books.ts`), and SASS partials with leading underscores (`_themes.scss`). Prefer small route modules and typed request handlers. There is no committed lint config yet, so keep changes consistent with nearby code and let `tsc` be the minimum quality gate.

## Testing Guidelines
This repository does not currently include an automated test suite or coverage threshold. Until one is added, verify changes by running `npm run build` and manually smoke-testing the affected flows in `npm run dev`, especially book CRUD, notes, series, and wishlist routes. If you add tests, place frontend tests beside the feature or under `frontend/src/`, and backend tests under `backend/src/` or `backend/tests/` with names ending in `.test.ts`.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects such as `Fix auto-focus on add book modal search field`. Keep commits focused and descriptive, and separate refactors from behavior changes when possible. Pull requests should include a brief summary, manual verification steps, linked issues when relevant, and screenshots or short recordings for UI changes.

## Configuration & Data Notes
The app uses a local SQLite database file at `books.db`; do not commit ad hoc database state changes unless the task explicitly requires fixture updates. Frontend production settings live in `frontend/.env.production`, and deployment-related changes should stay aligned with `deploy.sh`, `nginx-vs-book-app.conf`, and `vs-book-app.service`.
