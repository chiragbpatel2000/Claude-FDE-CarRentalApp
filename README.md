# DriveEasy – Car Rental App

React + Vite frontend, Express API, Postgres (Neon) database.

- Browse cars with daily/weekly rates, search by dates (booked cars are hidden), book online
- Email/password accounts (JWT in an httpOnly cookie)
- Admin role: manage cars and view/cancel all bookings

## Run locally

```bash
npm install
cp .env.example .env      # then set DATABASE_URL (and JWT_SECRET)
npm run dev               # API on :3001, web on :5173
```

Tables are created and 9 sample cars are seeded on first start.

Make a user an admin (sign up in the app first):

```bash
npm run make-admin -- you@example.com
```

## Production

```bash
npm run build
NODE_ENV=production npm start   # needs DATABASE_URL and JWT_SECRET
```

Express serves the built frontend and the API from one origin. See `render.yaml` for the Render setup.

Car photos are from Wikimedia Commons (CC-licensed).
