import pg from 'pg';

export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  pool.on('error', error => console.error('Idle database connection failed:', error.code || error.name));
  return pool;
}
