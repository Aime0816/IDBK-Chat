import { db } from '../apps/api/src/infrastructure/database.js';
import { secret, hash, audit } from '../apps/api/src/infrastructure/core.js';
const [username, reason] = process.argv.slice(2);
if (!username || !reason || reason.length < 10)
  throw new Error(
    'Usage: npm run account:recovery -- username "Verified identity against school records by named staff"',
  );
const u = await db('users').where({ username }).first();
if (!u || u.status === 'closed') throw new Error('Account unavailable');
const token = secret();
await db.transaction(async (trx) => {
  await trx('tokens').where({ user_id: u.id, kind: 'reset' }).del();
  await trx('tokens').insert({
    hash: hash(token),
    user_id: u.id,
    kind: 'reset',
    expires_at: Date.now() + 1800000,
  });
  await audit(null, 'recovery.operator', u.id, reason, trx);
});
console.log('Privately deliver this single-use link only after identity verification:');
console.log(`${process.env.APP_ORIGIN || 'http://localhost:3000'}/reset?token=${token}`);
await db.destroy();
