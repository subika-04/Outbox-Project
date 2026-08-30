import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { env } from './config/env';
import { redisConnection } from './config/redis';
import authRoutes from './routes/authRoutes';
import senderRoutes from './routes/senderRoutes';
import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import { requireAdmin } from './middleware/authMiddleware';
import { bullBoardRouter, BULL_BOARD_BASE_PATH } from './config/bullBoard';
import './workers/emailWorker';
import './workers/reindexWorker';
import { ElasticsearchService } from './services/elasticsearchService';
import { setupReindexRepeatableJob } from './queues/reindexQueue';

const app = express();
const PORT = env.PORT || 9000;

// Security & utility middlewares
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://reachinbox-one-rho.vercel.app',
  ...env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean),
];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis session store configuration
const redisStore = new RedisStore({
  client: redisConnection,
  prefix: 'session:',
});

app.use(
  session({
    store: redisStore,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid', // Session cookie name
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      // Cross-site cookie (Vercel frontend + Render backend are different domains) needs
      // sameSite:'none', which browsers only accept when the cookie is also 'secure'.
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Routes
app.use('/auth', authRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Bull Board admin dashboard — session auth + single ADMIN_EMAIL check.
// Single-admin access only, not per-owner scoping (see README).
app.use(BULL_BOARD_BASE_PATH, requireAdmin as any, bullBoardRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// Global 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Global Error Handler:', err);

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message,
      details: env.NODE_ENV === 'production' ? undefined : err.stack || err,
    },
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 ReachInbox Scheduler Backend running on port ${PORT} in ${env.NODE_ENV} mode`);
  await ElasticsearchService.initIndex();
  await setupReindexRepeatableJob();
});
