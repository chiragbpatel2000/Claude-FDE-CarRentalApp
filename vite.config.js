import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to /api on the Vite origin; Vite forwards it to the Express server.
// Same origin means the session cookie just works, with no CORS setup.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
