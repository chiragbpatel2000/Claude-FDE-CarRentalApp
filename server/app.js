import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { query, withTx, carFromRow, bookingFromRow, isCarFree } from './db.js';
import {
  authRateLimit, clearSession, hashPassword, loadUser, publicUser, requireAdmin, requireAuth, setSession, verifyPassword,
} from './auth.js';
// Pricing is shared with the UI so the quote the user sees is the price the server charges.
import { EXTRAS, countDays, quote, todayStr } from '../src/lib/pricing.js';

const MAX_DAYS = 60;
const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const TRANSMISSIONS = ['Automatic', 'Manual'];
const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Validates and normalises an admin-submitted car. Throws HttpError(400) with a specific message.
function parseCar(body = {}) {
  const bad = (m) => { throw new HttpError(400, m); };
  const name = str(body.name, 100);
  const category = str(body.category, 50);
  if (!name) bad('Name is required.');
  if (!category) bad('Category is required.');
  const image = str(body.image, 500) || null;
  if (image && !/^(\/|https:\/\/)/.test(image)) bad('Image must be a /path or an https:// URL.');
  const color = str(body.color, 7) || '#4f8cff';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) bad('Color must look like #4f8cff.');
  const seats = Number(body.seats), mpg = Number(body.mpg), bags = Number(body.bags);
  const dailyRate = Number(body.dailyRate), weeklyRate = Number(body.weeklyRate);
  if (!intIn(seats, 1, 12)) bad('Seats must be a whole number from 1 to 12.');
  if (!intIn(bags, 0, 20)) bad('Bags must be a whole number from 0 to 20.');
  if (!intIn(mpg, 0, 500)) bad('MPG must be a whole number from 0 to 500.');
  if (!TRANSMISSIONS.includes(body.transmission)) bad('Choose a transmission.');
  if (!FUELS.includes(body.fuel)) bad('Choose a fuel type.');
  if (!(dailyRate > 0 && dailyRate <= 5000)) bad('Daily rate must be between 0 and 5000.');
  if (!(weeklyRate > 0 && weeklyRate <= 35000)) bad('Weekly rate must be between 0 and 35000.');
  if (weeklyRate > dailyRate * 7) bad('Weekly rate cannot be more than 7 × the daily rate.');
  const features = Array.isArray(body.features) ? body.features.map((f) => str(f, 50)).filter(Boolean) : [];
  if (features.length > 12) bad('At most 12 features.');
  return {
    name, category, image, color, emoji: str(body.emoji, 8) || '🚗', seats, mpg, bags,
    transmission: body.transmission, fuel: body.fuel, dailyRate, weeklyRate, features,
    active: body.active !== false,
  };
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use(loadUser);

  // ---------- Auth ----------
  app.post('/api/auth/register', authRateLimit, async (req, res) => {
    const name = str(req.body?.name, 100);
    const email = str(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!name) throw new HttpError(400, 'Name is required.');
    if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must be at least 8 characters.');
    const user = { id: crypto.randomUUID(), name, email, role: 'customer' };
    try {
      await query('INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
        [user.id, name, email, hashPassword(password), user.role]);
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'An account with this email already exists.'); // unique violation
      throw e;
    }
    setSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', authRateLimit, async (req, res) => {
    const email = str(req.body?.email, 254).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { rows: [user] } = await query('SELECT * FROM users WHERE email = $1', [email]);
    // Same message for unknown email and wrong password.
    if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, 'Incorrect email or password.');
    setSession(res, user);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (_req, res) => { clearSession(res); res.json({ ok: true }); });
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

  // ---------- Cars (public) ----------
  // Optional ?start=&end= hides cars already booked for any of those days.
  app.get('/api/cars', async (req, res) => {
    const { start, end } = req.query;
    let rows;
    if (start || end) {
      if (!isIsoDate(start) || !isIsoDate(end) || end < start) throw new HttpError(400, 'Invalid dates.');
      ({ rows } = await query(
        `SELECT * FROM cars c WHERE c.active AND NOT EXISTS (
           SELECT 1 FROM bookings b WHERE b.car_id = c.id AND b.status = 'confirmed' AND b.start_date <= $2 AND b.end_date >= $1
         ) ORDER BY c.id`, [start, end]));
    } else {
      ({ rows } = await query('SELECT * FROM cars WHERE active ORDER BY id'));
    }
    res.json({ cars: rows.map(carFromRow) });
  });

  // Includes only the booked date ranges (no personal data) so the UI can warn early.
  app.get('/api/cars/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { rows: [row] } = Number.isInteger(id)
      ? await query('SELECT * FROM cars WHERE id = $1 AND active', [id]) : { rows: [] };
    if (!row) throw new HttpError(404, 'Car not found.');
    const { rows: bookedRanges } = await query(
      `SELECT start_date AS "startDate", end_date AS "endDate" FROM bookings
       WHERE car_id = $1 AND status = 'confirmed' AND end_date >= $2 ORDER BY start_date`, [row.id, todayStr()]);
    res.json({ car: { ...carFromRow(row), bookedRanges } });
  });

  // ---------- Bookings (auth required, own bookings only) ----------
  const bookingSelect = `SELECT b.*, c.name AS car_name FROM bookings b JOIN cars c ON c.id = b.car_id`;

  app.get('/api/bookings', requireAuth, async (req, res) => {
    const { rows } = await query(`${bookingSelect} WHERE b.user_id = $1 ORDER BY b.created_at DESC`, [req.user.id]);
    res.json({ bookings: rows.map(bookingFromRow) });
  });

  app.post('/api/bookings', requireAuth, async (req, res) => {
    const b = req.body || {};
    const carId = Number(b.carId);
    const { rows: [carRow] } = Number.isInteger(carId)
      ? await query('SELECT * FROM cars WHERE id = $1 AND active', [carId]) : { rows: [] };
    if (!carRow) throw new HttpError(404, 'Car not found.');
    const car = carFromRow(carRow);

    if (!isIsoDate(b.startDate) || !isIsoDate(b.endDate)) throw new HttpError(400, 'Invalid dates.');
    if (b.startDate < todayStr()) throw new HttpError(400, 'Pick-up date cannot be in the past.');
    if (b.endDate < b.startDate) throw new HttpError(400, 'Return date must be on or after pick-up.');
    const days = countDays(b.startDate, b.endDate);
    if (days > MAX_DAYS) throw new HttpError(400, `Rentals are limited to ${MAX_DAYS} days.`);

    const extraIds = Array.isArray(b.extras) ? [...new Set(b.extras)] : [];
    const chosen = EXTRAS.filter((e) => extraIds.includes(e.id));
    if (chosen.length !== extraIds.length) throw new HttpError(400, 'Unknown extra selected.');

    const name = str(b.customer?.name, 100);
    const email = str(b.customer?.email, 254);
    const phone = str(b.customer?.phone, 30);
    if (!name || !isEmail(email) || !phone) throw new HttpError(400, 'Name, valid email and phone are required.');

    const price = quote(car, days, chosen.reduce((s, e) => s + e.perDay, 0));
    const id = crypto.randomUUID();

    // Lock the car's row so concurrent requests for the same car queue up, then check + insert atomically.
    await withTx(async (c) => {
      const { rows: [locked] } = await c.query('SELECT id FROM cars WHERE id = $1 AND active FOR UPDATE', [car.id]);
      if (!locked) throw new HttpError(404, 'Car not found.');
      if (!(await isCarFree(car.id, b.startDate, b.endDate, c))) {
        throw new HttpError(409, 'Sorry, this car was just booked for those dates.');
      }
      await c.query(
        `INSERT INTO bookings
          (id, user_id, car_id, start_date, end_date, days, extras, customer_name, customer_email, customer_phone, total, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed')`,
        [id, req.user.id, car.id, b.startDate, b.endDate, days, JSON.stringify(chosen.map((e) => e.id)),
          name, email, phone, Math.round(price.total * 100) / 100]);
    });
    const { rows: [row] } = await query(`${bookingSelect} WHERE b.id = $1`, [id]);
    res.status(201).json({ booking: bookingFromRow(row) });
  });

  app.post('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
    const { rowCount } = await query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!rowCount) throw new HttpError(404, 'Booking not found.');
    res.json({ ok: true });
  });

  // ---------- Admin: car management ----------
  const carParams = (c) => [c.name, c.category, c.image, c.emoji, c.color, c.seats, c.transmission, c.fuel, c.mpg,
    c.bags, c.dailyRate, c.weeklyRate, JSON.stringify(c.features), c.active];
  const carIdParam = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Car not found.');
    return id;
  };

  app.get('/api/admin/cars', requireAdmin, async (_req, res) => {
    const { rows } = await query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM bookings b
                    WHERE b.car_id = c.id AND b.status = 'confirmed' AND b.end_date >= $1) AS upcoming
       FROM cars c ORDER BY c.id`, [todayStr()]);
    res.json({ cars: rows.map((r) => ({ ...carFromRow(r), upcomingBookings: r.upcoming })) });
  });

  app.post('/api/admin/cars', requireAdmin, async (req, res) => {
    const c = parseCar(req.body);
    const { rows: [row] } = await query(
      `INSERT INTO cars (name, category, image, emoji, color, seats, transmission, fuel, mpg, bags, daily_rate, weekly_rate, features, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, carParams(c));
    res.status(201).json({ car: carFromRow(row) });
  });

  app.put('/api/admin/cars/:id', requireAdmin, async (req, res) => {
    const id = carIdParam(req);
    const c = parseCar(req.body);
    const { rows: [row] } = await query(
      `UPDATE cars SET name=$1, category=$2, image=$3, emoji=$4, color=$5, seats=$6, transmission=$7, fuel=$8,
         mpg=$9, bags=$10, daily_rate=$11, weekly_rate=$12, features=$13, active=$14
       WHERE id = $15 RETURNING *`, [...carParams(c), id]);
    if (!row) throw new HttpError(404, 'Car not found.');
    res.json({ car: carFromRow(row) });
  });

  // Hard delete only when the car has never been booked; otherwise deactivate it instead.
  app.delete('/api/admin/cars/:id', requireAdmin, async (req, res) => {
    const id = carIdParam(req);
    try {
      const { rowCount } = await query('DELETE FROM cars WHERE id = $1', [id]);
      if (!rowCount) throw new HttpError(404, 'Car not found.');
    } catch (e) {
      if (e.code === '23503') { // foreign key violation: bookings reference this car
        throw new HttpError(409, 'This car has booking history and cannot be deleted. Deactivate it instead.');
      }
      throw e;
    }
    res.json({ ok: true });
  });

  // ---------- Admin: booking management ----------
  app.get('/api/admin/bookings', requireAdmin, async (_req, res) => {
    const { rows } = await query(`
      SELECT b.*, c.name AS car_name, u.name AS user_name, u.email AS user_email
      FROM bookings b
      JOIN cars c ON c.id = b.car_id
      JOIN users u ON u.id = b.user_id
      ORDER BY b.start_date DESC, b.created_at DESC LIMIT 1000`);
    res.json({
      bookings: rows.map((r) => ({ ...bookingFromRow(r), account: { name: r.user_name, email: r.user_email } })),
    });
  });

  app.post('/api/admin/bookings/:id/cancel', requireAdmin, async (req, res) => {
    const { rows: [row] } = await query('SELECT status FROM bookings WHERE id = $1', [req.params.id]);
    if (!row) throw new HttpError(404, 'Booking not found.');
    if (row.status === 'cancelled') throw new HttpError(409, 'This booking is already cancelled.');
    await query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  });

  // ---------- Errors ----------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}
