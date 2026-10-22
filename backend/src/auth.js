import { Router } from 'express';
import { HttpError, emailInput, textInput } from './validation.js';
import { digest, hashPassword, verifyPassword, passwordInput, newSession, rateLimit, userColumns, transaction, sessionCookie, setCookie, safeEqual } from './security.js';

export const route = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function authRoutes(db, secure, cookieName) {
  const router = Router();
  let dummyHash;
  router.post('/register', route(async (req, res) => {
    await rateLimit(db, `register:${req.ip}`, 20);
    const name = textInput(req.body.name, 'Name', 80);
    const email = emailInput(req.body.email);
    const password = passwordInput(req.body.password);
    const hash = await hashPassword(password);
    const result = await transaction(db, async client => {
      const { rows } = await client.query(`INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING ${userColumns}`, [name, email, hash]);
      const csrf = await newSession(client, res, rows[0].id, secure, cookieName);
      return { user: rows[0], csrf };
    });
    res.status(201).json(result);
  }));
  router.post('/login', route(async (req, res) => {
    const email = emailInput(req.body.email);
    await rateLimit(db, `login-ip:${req.ip}`, 60);
    await rateLimit(db, `login-email:${email}`, 15);
    const { rows } = await db.query(`SELECT ${userColumns},password_hash FROM users WHERE email=$1`, [email]);
    if (!dummyHash) dummyHash = hashPassword('dummy-password-not-an-account');
    const valid = await verifyPassword(req.body.password, rows[0]?.password_hash || await dummyHash);
    if (!valid || !rows.length || rows[0].disabled) throw new HttpError(401, 'Email or password is incorrect, or the account is disabled.');
    const { password_hash, ...user } = rows[0];
    const csrf = await transaction(db, async client => {
      const old = sessionCookie(req, cookieName);
      if (old) await client.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
      await client.query('DELETE FROM sessions WHERE expires_at<NOW()');
      await client.query('DELETE FROM auth_limits WHERE reset_at<NOW()');
      return newSession(client, res, user.id, secure, cookieName);
    });
    res.json({ user, csrf });
  }));
  return router;
}

export function authenticate(db, cookieName) {
  return route(async (req, _res, next) => {
    const cookie = sessionCookie(req, cookieName);
    if (!cookie) throw new HttpError(401, 'Please sign in to continue.');
    const { rows } = await db.query(`SELECT u.id::text,u.name,u.email,u.bio,u.theme,u.notifications_enabled,u.role,u.disabled,u.created_at,s.csrf,s.token_hash
      FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND NOT u.disabled`, [digest(cookie)]);
    if (!rows.length) throw new HttpError(401, 'Your session has expired. Please sign in again.');
    const { csrf, token_hash, ...user } = rows[0];
    req.user = user; req.csrf = csrf; req.sessionHash = token_hash;
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && !safeEqual(req.headers['x-csrf-token'], csrf)) throw new HttpError(403, 'Invalid session token. Refresh the page and try again.');
    next();
  });
}

export function accountRoutes(db, secure, cookieName) {
  const router = Router();
  router.get('/me', (req, res) => res.json({ user: req.user, csrf: req.csrf }));
  router.post('/logout', route(async (req, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash=$1', [req.sessionHash]);
    setCookie(res, '', secure, 0, cookieName); res.status(204).end();
  }));
  router.patch('/profile', route(async (req, res) => {
    const name = textInput(req.body.name ?? req.user.name, 'Name', 80);
    const bio = textInput(req.body.bio ?? req.user.bio, 'Bio', 500, true);
    const theme = req.body.theme ?? req.user.theme;
    const enabled = req.body.notifications_enabled ?? req.user.notifications_enabled;
    if (!['light','dark','system'].includes(theme) || typeof enabled !== 'boolean') throw new HttpError(400, 'Invalid account settings.');
    const { rows } = await db.query(`UPDATE users SET name=$1,bio=$2,theme=$3,notifications_enabled=$4 WHERE id=$5 RETURNING ${userColumns}`, [name, bio, theme, enabled, req.user.id]);
    res.json(rows[0]);
  }));
  router.post('/password', route(async (req, res) => {
    await rateLimit(db, `password:${req.user.id}`, 10);
    const nextPassword = passwordInput(req.body.new_password);
    const hash = await hashPassword(nextPassword);
    const csrf = await transaction(db, async client => {
      const { rows } = await client.query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
      if (!await verifyPassword(req.body.current_password, rows[0].password_hash)) throw new HttpError(400, 'Current password is incorrect.');
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
      return newSession(client, res, req.user.id, secure, cookieName);
    });
    res.json({ csrf, message: 'Password changed. Other sessions have been signed out.' });
  }));
  return router;
}
