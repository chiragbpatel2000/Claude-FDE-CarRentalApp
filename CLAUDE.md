# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                          # API (:3001, node --watch) + Vite (:5173) together
npm run build                        # vite build -> dist/
NODE_ENV=production npm start        # Express serves API + dist/ (needs JWT_SECRET)
npm run make-admin -- <email>        # grant admin (add --revoke to remove); user must have signed up first
```

There is no linter and no test runner configured. Verification so far has been ad-hoc scripts that import `createApp()` from `server/app.js`, listen on port 0, and drive it with `fetch` (keeping a cookie jar by hand). Clean up any data such scripts create.

## Environment

`server/db.js` loads `.env` (gitignored) via `process.loadEnvFile` and throws if `DATABASE_URL` is missing. `.env.example` lists the variables. In production `JWT_SECRET` is required; in dev `server/auth.js` generates one into the gitignored `server/.jwt-secret`. Requires Node >= 22 (top-level `await` in `db.js`, `loadEnvFile`).

The database is a single hosted Neon Postgres (via its pooler). Local dev and production **share the same database** unless `DATABASE_URL` is changed, so scripts and manual testing touch real data.

## Architecture

One repo, one origin: a React 18 + Vite SPA (`src/`) and an Express 5 API (`server/`) that also serves `dist/` in production.

- **Dev proxy**: `vite.config.js` forwards `/api` to `localhost:3001`, so the browser always talks same-origin and the session cookie needs no CORS. In production Express serves `dist/` with an SPA fallback (`/{*splat}`) registered *after* the `/api` 404 handler.
- **Auth**: JWT in an httpOnly cookie (`token`), no localStorage. `loadUser` middleware re-reads the user (and thus `role`) from the DB on every request, so role changes via `make-admin` apply immediately. Admin can only be granted via the CLI script, never through signup. Frontend state lives in `src/lib/auth.jsx` (`AuthProvider`/`useAuth`); `RequireAuth` in `App.jsx` guards routes (`admin` prop for admin pages) but the server enforces access independently (`requireAuth`/`requireAdmin`).
- **Data layer**: all frontend network calls go through `src/lib/api.js` (thin `fetch` wrapper that throws `Error` with `.status` and the server's `{error}` message). Server DB access uses `query()` / `withTx()` from `server/db.js` (`pg` pool). Express 5 forwards rejected async handlers to the error middleware, so route handlers throw `HttpError` instead of calling `next`.
- **Schema** is created with `CREATE TABLE IF NOT EXISTS` at module load in `server/db.js` (no migration tool), and 9 cars from `server/cars-seed.js` are inserted only when the `cars` table is empty. Changing a column on an existing database needs a manual `ALTER` added there.
- **Dates** are ISO `YYYY-MM-DD` *text* columns/strings everywhere (never `Date` objects), so overlap checks are plain string comparisons: ranges are inclusive, conflict when `start <= other.end && end >= other.start`.
- **Pricing is shared code**: `src/lib/pricing.js` is imported by both the UI and `server/app.js`. The server recomputes the total on booking and ignores any client-sent total. Full 7-day blocks use the weekly rate; leftover days use the daily rate capped at one weekly rate; extras are per-day; 10% tax.
- **Double-booking protection**: `POST /api/bookings` runs in a transaction that locks the car row (`SELECT ... FOR UPDATE`) before checking `isCarFree` and inserting. Keep that pattern for anything else that writes bookings.
- **Availability model**: public `GET /api/cars?start&end` filters out booked cars server-side (the browser never sees other users' bookings); `GET /api/cars/:id` returns only anonymous `bookedRanges`. Cars are soft-deactivated (`active = false`) rather than deleted once they have bookings (FK violation `23503` is mapped to a 409).
- **Car images**: files in `public/cars/*.jpg` referenced by path in the `image` column (Wikimedia Commons, CC-licensed); admins can also supply an `https://` URL. `CarImage` falls back to an emoji on a gradient on load error.

## Deployment

`render.yaml` is a Render Blueprint (single web service; build `npm ci --include=dev && npm run build`, start `npm start`, health check `/api/health`). `DATABASE_URL` is set manually in the Render dashboard; `JWT_SECRET` is generated. In production the app sets `trust proxy` (needed for `req.ip` rate limiting and `Secure` cookies behind Render's proxy). The auth rate limiter is in-memory, so it is per-instance.

## Gotchas

- The Bash tool in this environment fails to parse some commands containing certain mixed-quote heredocs; writing multi-line scripts to a file with the Write tool and running them is the reliable route. `pkill` is not available.
