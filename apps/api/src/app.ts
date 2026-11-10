import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import path from 'node:path';
import { ZodError } from 'zod';
import { db } from './infrastructure/database.js';
import { authenticate, csrf } from './middleware/auth.js';
import { auth } from './modules/auth.js';
import { school } from './modules/school.js';
import { announcements } from './modules/announcements.js';
import { conversations } from './modules/conversations.js';
import { messages } from './modules/messages.js';
import { moderation } from './modules/moderation.js';
import { attachments } from './modules/attachments.js';
export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
  }),
);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.get('/api/health', async (_req, res) => {
  await db.raw('select 1');
  res.json({ status: 'ok' });
});
app.use(
  '/api',
  authenticate,
  rateLimit({
    windowMs: 60000,
    limit: 300,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || '127.0.0.1'),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
  }),
  csrf,
  (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  },
);
app.use('/api/v1/auth', auth);
app.use('/api/v1/school', school);
app.use('/api/v1/announcements', announcements);
app.use('/api/v1/conversations', conversations);
app.use('/api/v1/messages', messages);
app.use('/api/v1/moderation', moderation);
app.use('/api/v1/attachments', attachments);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(express.static(path.resolve('web-dist')));
app.get('/{*splat}', (_req, res) => res.sendFile(path.resolve('web-dist/index.html')));
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof ZodError)
    return res.status(422).json({ error: err.issues.map((i) => i.message).join('; ') });
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'Maximum file size is 10 MB' });
  if (
    ['ER_DUP_ENTRY', 'SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY'].includes(err.code)
  )
    return res.status(409).json({ error: 'This record already exists. Refresh and retry.' });
  const status = err.status || 500;
  if (status === 500) console.error(err.message);
  res.status(status).json({ error: status === 500 ? 'Unexpected server error' : err.message });
});
