import bcrypt from 'bcryptjs';
import { db, migrate } from '../apps/api/src/infrastructure/database.js';
import { id, audit } from '../apps/api/src/infrastructure/core.js';
await migrate();
const username = process.env.ADMIN_USERNAME?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!username || !password || password.length < 12)
  throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters) in .env first');
if (await db('users').where({ role: 'admin' }).first())
  throw new Error(
    'Administrator already exists. This bootstrap command cannot overwrite accounts.',
  );
const uid = id();
await db('users').insert({
  id: uid,
  name: process.env.ADMIN_NAME || 'School administrator',
  username,
  email: process.env.ADMIN_EMAIL || null,
  password_hash: await bcrypt.hash(password, 12),
  role: 'admin',
  status: 'active',
  created_at: Date.now(),
});
await audit(null, 'admin.bootstrap', uid, 'Initial administrator created by operator');
console.log('Administrator created. Remove ADMIN_PASSWORD from .env after recording it securely.');
await db.destroy();
