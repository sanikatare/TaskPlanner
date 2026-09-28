import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './utils/database';
import { initFirebaseAdmin } from './utils/firebaseAdmin';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { startNotificationScheduler } from './services/notifications';

// Route imports
import authRoutes     from './routes/auth';
import taskRoutes     from './routes/tasks';
import scheduleRoutes from './routes/schedule';
import analyticsRoutes from './routes/analytics';
import aiRoutes       from './routes/ai';
import calendarRoutes from './routes/calendar';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT ?? 3000);

// Trust reverse proxy (Cloud Run / load balancer) for accurate X-Forwarded-For handling
app.set('trust proxy', 1);

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin:      process.env.FRONTEND_URL ?? true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message:  { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/schedule',  scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/calendar',  calendarRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve built frontend static files
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(
    express.static(frontendDistPath, {
      etag: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// CRITICAL route-level fallback for database queries failing when MongoDB is offline
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || err.message.includes('buffering timed out')) {
    console.warn('[AI Studio] Database offline — returning mock empty response');
    if (req.method === 'GET') {
      return res.json({
        success: true,
        data: req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {},
      });
    }
    return res.status(503).json({ success: false, error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// Global error handler
app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  initFirebaseAdmin();
  startNotificationScheduler();
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(err => {
  logger.error('Bootstrap error:', err);
  process.exit(1);
});

export default app;
