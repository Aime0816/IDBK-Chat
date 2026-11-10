import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'idbk-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = process.env.TEST_DB_CLIENT || 'sqlite';
process.env.SQLITE_FILE = path.join(tmp, 'test.sqlite');
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.DEV_ALLOW_UNSCANNED = 'false';
delete process.env.CLAMAV_HOST;
const { app } = await import('../apps/api/src/app.js');
const { db, migrate } = await import('../apps/api/src/infrastructure/database.js');
const { id } = await import('../apps/api/src/infrastructure/core.js');
const password = 'A-long-test-password-42!';
let admin: any, teacher: any, alice: any, bob: any, charlie: any;
let cid: string, otherClass: string, conv: string, notice: string, mid: string;
const adminId = id(),
  teacherId = id();
async function login(username: string) {
  const agent = request.agent(app);
  const r = await agent.post('/api/v1/auth/login').send({ username, password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { agent, csrf: r.body.csrf, id: r.body.user.id };
}
function post(a: any, url: string, body: any = {}) {
  return a.agent
    .post('/api/v1' + url)
    .set('x-csrf-token', a.csrf)
    .send(body);
}
async function apply(username: string, number: string, classId: string) {
  const r = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: username, username, number, classId, password });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return login(username);
}
async function approve(a: any) {
  const application = await db('applications').where({ user_id: a.id }).first();
  return post(admin, `/school/applications/${application.id}/decision`, {
    decision: 'approve',
    reason: 'Verified against approved school records',
    evidence: 'School register checked by class teacher',
  });
}
before(async () => {
  await migrate();
  assert.equal(
    (await db('users').count('* as n').first())?.n,
    0,
    'Tests require an empty test database',
  );
  const pw = await bcrypt.hash(password, 4);
  await db('users').insert([
    {
      id: adminId,
      name: 'Administrator',
      username: 'admin.test',
      password_hash: pw,
      role: 'admin',
      status: 'active',
      created_at: Date.now(),
    },
    {
      id: teacherId,
      name: 'Teacher',
      username: 'teacher.test',
      password_hash: pw,
      role: 'teacher',
      status: 'active',
      created_at: Date.now(),
    },
  ]);
  admin = await login('admin.test');
  teacher = await login('teacher.test');
  const c = await post(admin, '/school/classes', {
    name: 'L4 SWD A',
    programme: 'SWD',
    year: '2026',
    expectedCount: 2,
  });
  assert.equal(c.status, 201);
  cid = c.body.id;
  otherClass = (
    await post(admin, '/school/classes', {
      name: 'L3 BDC',
      programme: 'BDC',
      year: '2026',
      expectedCount: 20,
    })
  ).body.id;
  conv = (await db('conversations').where({ class_id: cid }).first()).id;
});
after(async () => {
  await db.destroy();
  await fs.rm(tmp, { recursive: true, force: true });
});
test('health endpoint verifies database connectivity', async () =>
  assert.equal((await request(app).get('/api/health')).status, 200));
test('registration keeps claims pending and private', async () => {
  alice = await apply('alice.test', '00100', cid);
  bob = await apply('bob.test', '00101', cid);
  charlie = await apply('charlie.test', '00102', cid);
  assert.equal((await alice.agent.get('/api/v1/conversations')).status, 403);
  assert.equal((await db('enrolments').count('* as n').first())?.n, 0);
});
test('unassigned teacher cannot approve a student', async () => {
  const a = await db('applications').where({ user_id: alice.id }).first();
  assert.equal(
    (
      await post(teacher, `/school/applications/${a.id}/decision`, {
        decision: 'approve',
        reason: 'Enough reason',
        evidence: 'Verified identity',
      })
    ).status,
    403,
  );
});
test('CSRF and origin checks reject forged writes', async () => {
  assert.equal((await admin.agent.post('/api/v1/school/classes').send({})).status, 403);
  assert.equal(
    (
      await admin.agent
        .post('/api/v1/school/classes')
        .set('x-csrf-token', admin.csrf)
        .set('Origin', 'https://evil.example')
        .send({})
    ).status,
    403,
  );
});
test('approval atomically activates account and membership', async () => {
  assert.equal((await approve(alice)).status, 200);
  assert.equal((await db('users').where({ id: alice.id }).first()).status, 'active');
  assert.ok(await db('members').where({ conversation_id: conv, user_id: alice.id }).first());
  assert.equal(
    (await db('student_identifiers').where({ user_id: alice.id }).first()).number,
    '00100',
  );
});
test('simultaneous approvals do not exceed the final class place', async () => {
  const results = await Promise.all([approve(bob), approve(charlie)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  if (results[0].status !== 200) [bob, charlie] = [charlie, bob];
  assert.equal(
    Number(
      (
        await db('enrolments')
          .where({ class_id: cid })
          .whereNull('ended_at')
          .count('* as n')
          .first()
      )?.n,
    ),
    2,
  );
});
test('pending duplicate claim never steals verified identifier', async () => {
  const dupe = await apply('duplicate.test', '00100', otherClass);
  assert.equal((await approve(dupe)).status, 409);
  assert.equal((await db('users').where({ id: dupe.id }).first()).status, 'pending');
});
test('foreign class message history is not accessible', async () => {
  const other = (await db('conversations').where({ class_id: otherClass }).first()).id;
  assert.equal((await alice.agent.get('/api/v1/messages/' + other)).status, 404);
});
test('message retries are idempotent and payload reuse conflicts', async () => {
  const body = { clientId: id(), body: 'Hello from integration test', attachmentIds: [] };
  const r = await post(alice, '/messages/' + conv, body);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  mid = r.body.id;
  const retry = await post(alice, '/messages/' + conv, body);
  assert.equal(retry.body.id, mid);
  assert.equal(
    (await post(alice, '/messages/' + conv, { ...body, body: 'Different' })).status,
    409,
  );
  assert.equal(
    Number((await db('messages').where({ conversation_id: conv }).count('* as n').first())?.n),
    1,
  );
});
test('read cursor is monotonic and history is persistent', async () => {
  await post(bob, '/conversations/' + conv + '/read', { sequence: 1 });
  await post(bob, '/conversations/' + conv + '/read', { sequence: 0 });
  assert.equal(
    (await db('members').where({ conversation_id: conv, user_id: bob.id }).first()).read_sequence,
    1,
  );
  assert.equal(
    (await bob.agent.get('/api/v1/messages/' + conv + '?after=0')).body.messages[0].body,
    'Hello from integration test',
  );
});
test('teacher publishing is scoped; acknowledgements bind to revision', async () => {
  const body = {
    title: 'Important notice',
    body: 'Read before returning',
    classId: null,
    priority: 'important',
    requiresAck: true,
    status: 'published',
  };
  assert.equal((await post(teacher, '/announcements', body)).status, 403);
  const r = await post(admin, '/announcements', { ...body, classId: cid });
  assert.equal(r.status, 200);
  notice = r.body.id;
  assert.equal((await post(alice, `/announcements/${notice}/ack`, { revision: 1 })).status, 200);
  await post(alice, `/announcements/${notice}/ack`, { revision: 1 });
  assert.equal(
    Number(
      (
        await db('recipients')
          .where({ announcement_id: notice, user_id: alice.id })
          .count('* as n')
          .first()
      )?.n,
    ),
    1,
  );
  const update = await admin.agent
    .put('/api/v1/announcements/' + notice)
    .set('x-csrf-token', admin.csrf)
    .send({ ...body, classId: cid, title: 'Updated notice' });
  assert.equal(update.status, 200);
  assert.equal((await post(alice, `/announcements/${notice}/ack`, { revision: 1 })).status, 409);
  assert.equal(
    (
      await db('recipients')
        .where({ announcement_id: notice, user_id: alice.id, revision: 2 })
        .first()
    ).acknowledged_at,
    null,
  );
});
test('private group invitations require acceptance and leave revokes history', async () => {
  const gid = (await post(alice, '/conversations', { title: 'Study group' })).body.id;
  assert.equal((await post(alice, `/conversations/${gid}/invite`, { userId: bob.id })).status, 200);
  assert.equal((await bob.agent.get('/api/v1/messages/' + gid)).status, 404);
  const inv = (await bob.agent.get('/api/v1/conversations/invitations')).body.find(
    (i) => i.conversation_id === gid,
  );
  assert.equal(
    (await post(bob, `/conversations/invitations/${inv.id}`, { accept: true })).status,
    200,
  );
  assert.equal((await bob.agent.get('/api/v1/messages/' + gid)).status, 200);
  await post(bob, `/conversations/${gid}/leave`);
  assert.equal((await bob.agent.get('/api/v1/messages/' + gid)).status, 404);
});
test('block prevents new direct messages', async () => {
  const direct = await post(alice, '/conversations/direct', { userId: bob.id });
  assert.equal(direct.status, 200);
  await post(bob, '/moderation/blocks/' + alice.id);
  assert.equal(
    (await post(alice, '/messages/' + direct.body.id, { clientId: id(), body: 'Blocked' })).status,
    403,
  );
});
test('reports capture limited evidence and scoped moderators can hide', async () => {
  assert.equal(
    (await post(bob, '/moderation/reports', { messageId: mid, reason: 'Synthetic test report' }))
      .status,
    201,
  );
  assert.equal((await teacher.agent.get('/api/v1/moderation/reports')).body.length, 0);
  const reports = (await admin.agent.get('/api/v1/moderation/reports')).body;
  assert.ok(reports[0].evidence.length <= 5);
  assert.equal(
    (
      await post(admin, `/moderation/reports/${reports[0].id}/resolve`, {
        action: 'hide',
        reason: 'Test moderation outcome',
      })
    ).status,
    200,
  );
  const history = (await alice.agent.get('/api/v1/messages/' + conv)).body.messages;
  assert.equal(history[0].body, 'Message removed');
});
test('uploads reject disguised files and fail closed without scanner', async () => {
  const r = await alice.agent
    .post('/api/v1/attachments')
    .set('x-csrf-token', alice.csrf)
    .attach('file', Buffer.from('<script>alert(1)</script>'), 'fake.png');
  assert.equal(r.status, 422);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  );
  const p = await alice.agent
    .post('/api/v1/attachments')
    .set('x-csrf-token', alice.csrf)
    .attach('file', png, 'pixel.png');
  assert.equal(p.status, 503);
});
test('transfer revokes previous class access and preserves enrolment history', async () => {
  const r = await post(admin, `/school/users/${alice.id}/transfer`, {
    classId: otherClass,
    reason: 'Approved class transfer',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await alice.agent.get('/api/v1/messages/' + conv)).status, 404);
  assert.equal(
    Number((await db('enrolments').where({ user_id: alice.id }).count('* as n').first())?.n),
    2,
  );
});
test('suspension invalidates existing authenticated HTTP sessions', async () => {
  const r = await post(admin, `/school/users/${bob.id}/status`, {
    status: 'suspended',
    reason: 'Synthetic suspension test',
  });
  assert.equal(r.status, 200);
  assert.equal((await bob.agent.get('/api/v1/conversations')).status, 401);
});
test('recovery endpoint does not disclose account existence', async () => {
  const a = await request(app).post('/api/v1/auth/recovery').send({ username: 'missing.user' });
  const b = await request(app).post('/api/v1/auth/recovery').send({ username: 'alice.test' });
  assert.deepEqual(a.body, b.body);
});
test('private attachments can be sent and downloaded only by conversation members', async () => {
  process.env.DEV_ALLOW_UNSCANNED = 'true';
  delete process.env.CLAMAV_HOST;
  try {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    );
    const upload = await alice.agent
      .post('/api/v1/attachments')
      .set('x-csrf-token', alice.csrf)
      .attach('file', png, 'pixel.png');
    assert.equal(upload.status, 201, JSON.stringify(upload.body));
    const other = (await db('conversations').where({ class_id: otherClass }).first()).id;
    const sent = await post(alice, '/messages/' + other, {
      clientId: id(),
      body: 'Private attachment',
      attachmentIds: [upload.body.id],
    });
    assert.equal(sent.status, 201);
    assert.equal((await alice.agent.get('/api/v1/attachments/' + upload.body.id)).status, 200);
    assert.equal((await teacher.agent.get('/api/v1/attachments/' + upload.body.id)).status, 404);
    assert.equal((await request(app).get('/api/v1/attachments/' + upload.body.id)).status, 401);
  } finally {
    process.env.DEV_ALLOW_UNSCANNED = 'false';
  }
});
test('teacher assignment grants scope and removal revokes it', async () => {
  assert.equal(
    (await post(admin, `/school/classes/${otherClass}/teacher`, { userId: teacher.id })).status,
    200,
  );
  const c = (await db('conversations').where({ class_id: otherClass }).first()).id;
  assert.equal((await teacher.agent.get('/api/v1/messages/' + c)).status, 200);
  assert.equal(
    (
      await post(admin, `/school/classes/${otherClass}/teacher`, {
        userId: teacher.id,
        remove: true,
      })
    ).status,
    200,
  );
  assert.equal((await teacher.agent.get('/api/v1/messages/' + c)).status, 404);
});
test('archiving class ends enrolment and denies former conversation access', async () => {
  const c = (await db('conversations').where({ class_id: otherClass }).first()).id;
  assert.equal(
    (await post(admin, `/school/classes/${otherClass}/archive`, { reason: 'End of academic year' }))
      .status,
    200,
  );
  assert.equal((await alice.agent.get('/api/v1/messages/' + c)).status, 404);
  assert.equal(
    Number(
      (
        await db('enrolments')
          .where({ class_id: otherClass })
          .whereNull('ended_at')
          .count('* as n')
          .first()
      )?.n,
    ),
    0,
  );
});
test('password reset is single use and revokes existing sessions', async () => {
  const { secret, hash } = await import('../apps/api/src/infrastructure/core.js');
  const token = secret();
  await db('tokens').insert({
    hash: hash(token),
    user_id: alice.id,
    kind: 'reset',
    expires_at: Date.now() + 60000,
  });
  const body = { token, password: 'A-new-long-password-43!' };
  assert.equal((await request(app).post('/api/v1/auth/reset').send(body)).status, 200);
  assert.equal((await alice.agent.get('/api/v1/auth/me')).status, 401);
  assert.equal((await request(app).post('/api/v1/auth/reset').send(body)).status, 422);
  assert.equal(
    (
      await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'alice.test', password: body.password })
    ).status,
    200,
  );
});
