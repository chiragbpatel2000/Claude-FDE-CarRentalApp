import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE = 'token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// In production JWT_SECRET must be set. In dev we generate one once and keep it
// in a gitignored file so logins survive server restarts.
function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_PROD) throw new Error('JWT_SECRET must be set in production');
  const f = fileURLToPath(new URL('./.jwt-secret', import.meta.url));
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(f, 'utf8').trim();
}
const SECRET = getSecret();

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: MAX_AGE_MS, path: '/' });
}

export const clearSession = (res) => res.clearCookie(COOKIE, { path: '/' });

// Attaches req.user if there is a valid session; never rejects by itself.
export async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, SECRET);
      const { rows } = await query('SELECT * FROM users WHERE id = $1', [sub]);
      req.user = rows[0] || null;
    } catch (e) {
      // Bad/expired token -> anonymous. A database failure should surface as a 500 instead.
      if (!(e instanceof jwt.JsonWebTokenError || e instanceof jwt.TokenExpiredError)) return next(e);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

// Tiny in-memory limiter for login/register (per IP). Use a shared store if you ever run multiple instances.
const hits = new Map();
export function authRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const entry = hits.get(key);
  if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + 15 * 60 * 1000 });
  else if (++entry.count > 20) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  next();
}
