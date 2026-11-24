// Usage: node server/make-admin.js <email> [--revoke]
// The only way to grant or remove the admin role (it can't be self-assigned via signup).
import { pool, query } from './db.js';

const email = process.argv[2]?.toLowerCase();
const role = process.argv[3] === '--revoke' ? 'customer' : 'admin';
if (!email) {
  console.error('Usage: node server/make-admin.js <email> [--revoke]');
  process.exit(1);
}
const { rowCount } = await query('UPDATE users SET role = $1 WHERE email = $2', [role, email]);
await pool.end();
if (!rowCount) {
  console.error(`No user with email ${email}. Sign up in the app first, then run this again.`);
  process.exit(1);
}
console.log(`${email} is now ${role === 'admin' ? 'an admin' : 'a regular customer'}.`);
