import pg from 'pg';
import 'dotenv/config';
if (!process.env.DATABASE_URL) { console.error('Missing DATABASE_URL. Copy backend/.env.example to backend/.env and configure PostgreSQL.'); process.exit(1); }
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
