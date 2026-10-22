import { randomBytes, createHash, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './validation.js';

const scrypt = promisify(derive);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const token = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function passwordInput(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new HttpError(400, 'Use a password between 12 and 128 characters.');
  return value;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, options);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [algorithm, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const actual = await scrypt(password, salt, 64, options);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function safeEqual(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  return left.length === right.length && timingSafeEqual(left, right);
}
export function sessionCookie(req, name = 'taskflow_session') {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='));
  const value = cookie?.slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
export function setCookie(res, value, secure, expires = 604800, name = 'taskflow_session') {
  res.setHeader('Set-Cookie', `${name}=${value}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${expires}${secure ? '; Secure' : ''}`);
}
export const userColumns = 'id::text,name,email,bio,theme,notifications_enabled,role,disabled,created_at';
export async function transaction(db, fn) {
  const client = await db.connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function newSession(db, res, userId, secure, cookieName) {
  const session = token();
  const csrf = token();
  await db.query("INSERT INTO sessions (token_hash,user_id,csrf,expires_at) VALUES ($1,$2,$3,NOW()+INTERVAL '7 days')", [digest(session), userId, csrf]);
  setCookie(res, session, secure, 604800, cookieName);
  return csrf;
}
export async function rateLimit(db, key, max) {
  const { rows } = await db.query(`INSERT INTO auth_limits (key,attempts,reset_at) VALUES ($1,1,NOW()+INTERVAL '15 minutes')
    ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN auth_limits.reset_at<NOW() THEN 1 ELSE auth_limits.attempts+1 END,
    reset_at=CASE WHEN auth_limits.reset_at<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE auth_limits.reset_at END RETURNING attempts`, [digest(key)]);
  if (rows[0].attempts > max) throw new HttpError(429, 'Too many attempts. Please try again in 15 minutes.');
}
