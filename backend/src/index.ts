import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import booksRouter from './routes/books';
import notesRouter from './routes/notes';
import seriesRouter from './routes/series';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import feedbackRouter from './routes/feedback';
import messagesRouter from './routes/messages';
import { getDb } from './database';
import { requireAuth } from './middleware/auth';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../books.db');

// Two trusted hops in production: Cloudflare edge -> Traefik ingress. A blanket
// `true` would let clients spoof X-Forwarded-For and dodge the login rate limit.
app.set('trust proxy', IS_PROD ? 2 : false);

if (!IS_PROD) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] }));
}
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/books', requireAuth, booksRouter);
app.use('/api/notes', requireAuth, notesRouter);
app.use('/api/series', requireAuth, seriesRouter);
app.use('/api/feedback', requireAuth, feedbackRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (IS_PROD) {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

getDb().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Books API running on http://${HOST}:${PORT} using DB ${DB_PATH}`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
