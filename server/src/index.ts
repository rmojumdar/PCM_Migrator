import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { sessionMiddleware } from './middleware/session.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import authRoutes from './routes/auth.routes';
import migrationRoutes from './routes/migration.routes';

const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/migration', migrationRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
