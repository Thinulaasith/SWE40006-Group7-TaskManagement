import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

export function getConfig() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env before starting the backend.');
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  if (new URL(origin).origin !== origin) throw new Error('FRONTEND_ORIGIN must be an exact origin without a trailing slash.');
  return {
    databaseUrl: process.env.DATABASE_URL, port, origin,
    secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === 'true' : process.env.NODE_ENV === 'production',
    metricsToken: process.env.METRICS_TOKEN || '',
    trustProxy: process.env.TRUST_PROXY === 'true',
    staticDir: process.env.SERVE_FRONTEND === 'true' ? fileURLToPath(new URL('../../frontend/dist', import.meta.url)) : null
  };
}
