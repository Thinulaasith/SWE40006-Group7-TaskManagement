import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { HttpError } from './validation.js';
import { authRoutes, authenticate, accountRoutes, route } from './auth.js';
import { projectRoutes } from './projects.js';
import { taskRoutes } from './tasks.js';
import { notificationRoutes } from './notifications.js';
import { safeEqual } from './security.js';
import { fileRoutes } from './files.js';
import { planningRoutes } from './planning.js';
import { administrationRoutes } from './admin.js';
import { analyticsRoutes } from './analytics.js';

export function createApp({ db, origin = 'http://localhost:5173', logger = console, secureCookies = false, metricsToken = '', staticDir = null, trustProxy = false, cookieName = 'taskflow_session' }) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  const metrics = { requests: 0, errors: 0, duration: 0 };
  app.use((req, res, next) => {
    const started = performance.now();
    res.setHeader('X-Request-ID', randomUUID());
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      metrics.requests++; metrics.duration += (performance.now() - started) / 1000;
      if (res.statusCode >= 500) metrics.errors++;
    });
    next();
  });
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.get('/api/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/health', route(async (_req, res) => {
    try {
      await db.query('SELECT t.id,t.owner_id,t.start_date,t.completed_at,u.role,u.disabled,a.id,d.task_id,m.id,h.id FROM tasks t FULL JOIN users u ON FALSE FULL JOIN attachments a ON FALSE FULL JOIN task_dependencies d ON FALSE FULL JOIN milestones m ON FALSE FULL JOIN activity h ON FALSE LIMIT 0');
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      logger.error('Health check failed:', error.code || error.name);
      res.status(503).json({ status: 'error', database: 'unavailable', error: 'Database is unavailable or not initialized.' });
    }
  }));
  app.get('/api/metrics', (req, res) => {
    if (!metricsToken || !safeEqual(req.headers.authorization, `Bearer ${metricsToken}`)) return res.status(404).json({ error: 'Endpoint not found.' });
    res.type('text/plain').send(`# TYPE taskflow_http_requests_total counter\ntaskflow_http_requests_total ${metrics.requests}\n# TYPE taskflow_http_errors_total counter\ntaskflow_http_errors_total ${metrics.errors}\n# TYPE taskflow_http_duration_seconds_total counter\ntaskflow_http_duration_seconds_total ${metrics.duration}\n# TYPE taskflow_uptime_seconds gauge\ntaskflow_uptime_seconds ${process.uptime()}\n`);
  });
  app.use('/api', (req, _res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== origin) return next(new HttpError(403, 'Request origin is not allowed.'));
      if (req.headers['x-taskflow-request'] !== '1') return next(new HttpError(403, 'Missing request verification header.'));
      // File bytes are parsed only after session and CSRF verification.
      if(req.method==='POST' && /^\/tasks\/[1-9]\d*\/attachments$/.test(req.path) && req.is('application/octet-stream'))return next();
      if (req.headers['content-length'] !== '0' && req.headers['content-length'] && !req.is('application/json')) return next(new HttpError(415, 'Use Content-Type: application/json.'));
      if (req.body === null || Array.isArray(req.body) || typeof req.body !== 'object') return next(new HttpError(400, 'Request body must be a JSON object.'));
    }
    next();
  });
  app.use('/api/auth', authRoutes(db, secureCookies, cookieName));
  app.use('/api', authenticate(db, cookieName));
  app.use('/api', fileRoutes(db));
  app.use('/api', planningRoutes(db));
  app.use('/api', administrationRoutes(db));
  app.use('/api/analytics', analyticsRoutes(db));
  app.use('/api/auth', accountRoutes(db, secureCookies, cookieName));
  app.use('/api/projects', projectRoutes(db));
  app.use('/api/tasks', taskRoutes(db));
  app.use('/api/notifications', notificationRoutes(db));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint not found.')));
  if (staticDir) {
    app.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      next();
    });
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => res.sendFile('index.html', { root: staticDir }));
  }
  app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found.')));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request exceeds its size limit (10 MB for files, 50 KB for JSON).' });
    if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') return res.status(415).json({ error: 'Unsupported request encoding.' });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'That email or record is already in use.' });
    if (error.code === '23503') return res.status(409).json({ error: 'A related record changed. Refresh and try again.' });
    logger.error('API request failed:', error.code || error.name);
    res.status(500).json({ error: 'Database or server error.' });
  });
  return app;
}
