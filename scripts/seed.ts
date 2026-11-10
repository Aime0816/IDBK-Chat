import bcrypt from 'bcryptjs';
import { db, migrate } from '../apps/api/src/infrastructure/database.js';
import { id } from '../apps/api/src/infrastructure/core.js';
await migrate();
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true')
  throw new Error('Demo seed requires ALLOW_DEMO_SEED=true outside production');
if (await db('users').where({ username: 'aime.demo' }).first())
  throw new Error('Demo data already exists');
const pw = process.env.DEMO_PASSWORD;
if (!pw || pw.length < 12) throw new Error('Set DEMO_PASSWORD with at least 12 characters');
const hash = await bcrypt.hash(pw, 12),
  teacher = id(),
  aime = id(),
  grace = id(),
  cid = id(),
  conv = id();
await db.transaction(async (trx) => {
  await trx('users').insert([
    {
      id: teacher,
      name: 'Teacher Eric',
      username: 'teacher.demo',
      role: 'teacher',
      status: 'active',
      password_hash: hash,
      created_at: Date.now(),
    },
    {
      id: aime,
      name: 'Aime Ns',
      username: 'aime.demo',
      role: 'student',
      status: 'active',
      password_hash: hash,
      created_at: Date.now(),
    },
    {
      id: grace,
      name: 'Grace M.',
      username: 'grace.demo',
      role: 'student',
      status: 'active',
      password_hash: hash,
      created_at: Date.now(),
    },
  ]);
  await trx('classes').insert({
    id: cid,
    name: 'L4 SWD A',
    programme: 'Software Development',
    year: '2026–2027',
    expected_count: 30,
  });
  await trx('class_staff').insert({ class_id: cid, user_id: teacher });
  await trx('conversations').insert({
    id: conv,
    type: 'class',
    title: 'L4 SWD A',
    class_id: cid,
    sequence: 3,
    created_at: Date.now(),
  });
  for (const uid of [teacher, aime, grace])
    await trx('members').insert({ conversation_id: conv, user_id: uid });
  for (const uid of [aime, grace]) {
    await trx('enrolments').insert({ id: id(), class_id: cid, user_id: uid });
    await trx('student_identifiers').insert({ number: 'DEMO-' + uid.slice(0, 8), user_id: uid });
  }
  const texts = [
    'Hello everyone! Welcome to our holiday learning group.',
    'Thank you, teacher. Can we discuss exercise 3 here?',
    'Yes! Let’s work through it together.',
  ];
  for (let n = 0; n < 3; n++)
    await trx('messages').insert({
      id: id(),
      conversation_id: conv,
      sender_id: [teacher, grace, aime][n],
      client_id: id(),
      payload_hash: 'seed',
      sequence: n + 1,
      body: texts[n],
      created_at: Date.now() - 120000 + n * 30000,
    });
  const nid = id();
  const notice = {
    id: nid,
    publisher_id: teacher,
    class_id: cid,
    title: 'Holiday learning resources',
    body: 'Welcome to IDBK Chat. Use your class group to ask questions and share ideas during the holidays. This is sample content for development only.',
    priority: 'important',
    requires_ack: true,
    status: 'published',
    revision: 1,
    created_at: Date.now(),
  };
  await trx('announcements').insert(notice);
  await trx('announcement_revisions').insert({
    announcement_id: nid,
    revision: 1,
    content: JSON.stringify(notice),
    published_at: Date.now(),
  });
  for (const uid of [aime, grace, teacher])
    await trx('recipients').insert({ announcement_id: nid, revision: 1, user_id: uid });
});
console.log(
  'Synthetic demo users created: aime.demo, grace.demo, teacher.demo. Password is your DEMO_PASSWORD.',
);
await db.destroy();
