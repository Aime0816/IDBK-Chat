import fs from 'node:fs';
import crypto from 'node:crypto';
if (fs.existsSync('.env')) {
  console.log('.env already exists; no changes made.');
  process.exit(0);
}
const text = fs
  .readFileSync('.env.example', 'utf8')
  .replace('CHANGE_DATABASE_PASSWORD', crypto.randomBytes(24).toString('hex'))
  .replace('CHANGE_ROOT_PASSWORD', crypto.randomBytes(24).toString('hex'))
  .replace('CHANGE_ADMIN_PASSWORD', crypto.randomBytes(18).toString('base64url'));
fs.writeFileSync('.env', text, { mode: 0o600 });
console.log('Created .env with unique local passwords. Open it to view the admin credentials.');
