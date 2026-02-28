import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import booksRouter from './routes/books';
import notesRouter from './routes/notes';
import seriesRouter from './routes/series';
import { getDb } from './database';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] }));
app.use(express.json());

app.use('/api/books', booksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/series', seriesRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Books API running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
