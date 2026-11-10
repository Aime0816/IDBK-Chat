import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../infrastructure/database.js';
import { id, secret, hash, ensure, publicUser, audit } from '../infrastructure/core.js';
import { registerSchema, password } from '../../../../packages/contracts/src/index.js';
import { signed } from '../middleware/auth.js';
import { sendMail } from '../infrastructure/email.js';
export const auth = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});
async function tokenMail(user: any, kind: string) {
  const token = secret();
  await db('tokens').insert({
    hash: hash(token),
    user_id: user.id,
    kind,
    expires_at: Date.now() + 30 * 60 * 1000,
  });
  await sendMail(
    user.email,
    kind === 'verify' ? 'Verify your IDBK Chat email' : 'Reset your IDBK Chat password',
    `${process.env.APP_ORIGIN || 'http://localhost:5173'}/${kind}?token=${token}\nThis single-use link expires in 30 minutes.`,
  );
}
auth.get('/classes', async (_req, res) =>
  res.json(
    await db('classes')
      .where({ archived: false })
      .select('id', 'name', 'year', 'programme')
      .orderBy('name'),
  ),
);
auth.post('/register', limit, async (req, res) => {
  const v = registerSchema.parse(req.body);
  const c = await db('classes').where({ id: v.classId, archived: false }).first();
  ensure(c, 422, 'Select an open class');
  ensure(!(await db('users').where({ username: v.username }).first()), 409, 'Username unavailable');
  if (v.email)
    ensure(
      !(await db('users').where({ email: v.email.toLowerCase() }).first()),
      409,
      'Email unavailable',
    );
  const uid = id();
  const u = {
    id: uid,
    name: v.name,
    username: v.username,
    email: v.email?.toLowerCase() || null,
    password_hash: await bcrypt.hash(v.password, 12),
    role: 'student',
    status: 'pending',
    created_at: Date.now(),
  };
  await db.transaction(async (trx) => {
    await trx('users').insert(u);
    await trx('applications').insert({
      id: id(),
      user_id: uid,
      class_id: v.classId,
      claimed_number: v.number.toUpperCase(),
      status: 'pending',
      created_at: Date.now(),
    });
  });
  if (u.email)
    try {
      await tokenMail(u, 'verify');
    } catch {
      console.error('Verification email failed; user can resend');
    }
  res.status(201).json({ message: 'Application submitted. Sign in to check its status.' });
});
auth.post('/login', limit, async (req, res) => {
  const v = z
    .object({ username: z.string().max(190), password: z.string().max(128) })
    .parse(req.body);
  const u = await db('users').where({ username: v.username.trim().toLowerCase() }).first();
  ensure(
    u && (await bcrypt.compare(v.password, u.password_hash)),
    401,
    'Incorrect username or password',
  );
  ensure(
    !['suspended', 'closed'].includes(u.status),
    403,
    'Account unavailable. Contact school support.',
  );
  const token = secret(),
    csrf = secret();
  if (req.session) await db('sessions').where({ hash: req.session.hash }).del();
  await db('sessions').insert({
    hash: hash(token),
    csrf,
    user_id: u.id,
    expires_at: Date.now() + 12 * 3600000,
    last_seen: Date.now(),
  });
  res.cookie('idbk_session', token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    path: '/',
    maxAge: 12 * 3600000,
  });
  res.json({ user: publicUser(u), csrf });
});
auth.get('/me', signed, async (req, res) =>
  res.json({ user: publicUser(req.user), csrf: req.session.csrf }),
);
auth.post('/logout', signed, async (req, res) => {
  await db('sessions').where({ hash: req.session.hash }).del();
  res.clearCookie('idbk_session', { path: '/' });
  res.json({ ok: true });
});
auth.post('/recovery', limit, async (req, res) => {
  const v = z.object({ username: z.string().max(190) }).parse(req.body);
  const u = await db('users')
    .where({ username: v.username.toLowerCase(), email_verified: true })
    .first();
  if (u?.email)
    try {
      await tokenMail(u, 'reset');
    } catch {
      console.error('Recovery email failed');
    }
  res.json({
    message:
      'If a verified recovery email is available, a link has been sent. Otherwise contact school support.',
  });
});
auth.post('/reset', limit, async (req, res) => {
  const v = z.object({ token: z.string().length(64), password }).parse(req.body);
  const pw = await bcrypt.hash(v.password, 12);
  await db.transaction(async (trx) => {
    const t = await trx('tokens')
      .where({ hash: hash(v.token), kind: 'reset' })
      .forUpdate()
      .first();
    ensure(t && Number(t.expires_at) > Date.now(), 422, 'Link expired or already used');
    await trx('users').where({ id: t.user_id }).update({ password_hash: pw });
    await trx('sessions').where({ user_id: t.user_id }).del();
    await trx('tokens').where({ user_id: t.user_id, kind: 'reset' }).del();
    await audit(t.user_id, 'password.reset', t.user_id, 'Recovery token used', trx);
  });
  res.json({ ok: true });
});
auth.post('/verify', limit, async (req, res) => {
  const v = z.object({ token: z.string().length(64) }).parse(req.body);
  await db.transaction(async (trx) => {
    const t = await trx('tokens')
      .where({ hash: hash(v.token), kind: 'verify' })
      .forUpdate()
      .first();
    ensure(t && Number(t.expires_at) > Date.now(), 422, 'Link expired or used');
    await trx('users').where({ id: t.user_id }).update({ email_verified: true });
    await trx('tokens').where({ hash: t.hash }).del();
  });
  res.json({ ok: true });
});
auth.post('/verify/resend', signed, limit, async (req, res) => {
  ensure(req.user.email && !req.user.email_verified, 422, 'No unverified email');
  await tokenMail(req.user, 'verify');
  res.json({ ok: true });
});
auth.post('/password', signed, async (req, res) => {
  const v = z.object({ current: z.string(), password }).parse(req.body);
  ensure(
    await bcrypt.compare(v.current, req.user.password_hash),
    403,
    'Current password is incorrect',
  );
  const passwordHash = await bcrypt.hash(v.password, 12);
  await db.transaction(async (trx) => {
    await trx('users').where({ id: req.user.id }).update({ password_hash: passwordHash });
    await trx('sessions').where({ user_id: req.user.id }).del();
    await trx('tokens').where({ user_id: req.user.id, kind: 'reset' }).del();
  });
  res.clearCookie('idbk_session', { path: '/' });
  res.json({ ok: true });
});
auth.get('/application', signed, async (req, res) =>
  res.json(
    (await db('applications as a')
      .join('classes as c', 'c.id', 'a.class_id')
      .where('a.user_id', req.user.id)
      .select('a.*', 'c.name as class_name')
      .first()) || null,
  ),
);
auth.patch('/application', signed, async (req, res) => {
  const v = z
    .object({ number: z.string().trim().min(2).max(80), classId: z.uuid() })
    .parse(req.body);
  ensure(
    await db('classes').where({ id: v.classId, archived: false }).first(),
    422,
    'Invalid class',
  );
  const n = await db('applications')
    .where({ user_id: req.user.id, status: 'correction' })
    .update({ claimed_number: v.number.toUpperCase(), class_id: v.classId, status: 'pending' });
  ensure(n, 409, 'Corrections are not currently requested');
  res.json({ ok: true });
});
auth.post('/invitation', limit, async (req, res) => {
  const v = z
    .object({
      token: z.string().length(64),
      name: z.string().min(2).max(100),
      username: registerSchema.shape.username,
      password,
    })
    .parse(req.body);
  const pw = await bcrypt.hash(v.password, 12);
  await db.transaction(async (trx) => {
    const t = await trx('tokens')
      .where({ hash: hash(v.token), kind: 'staff' })
      .forUpdate()
      .first();
    ensure(t && Number(t.expires_at) > Date.now(), 422, 'Invitation invalid or expired');
    const p = JSON.parse(t.payload),
      uid = id();
    await trx('users').insert({
      id: uid,
      name: v.name,
      username: v.username,
      email: p.email,
      password_hash: pw,
      email_verified: true,
      role: p.role,
      status: 'active',
      created_at: Date.now(),
    });
    for (const cid of p.classIds) {
      await trx('class_staff').insert({ class_id: cid, user_id: uid });
      const c = await trx('conversations').where({ class_id: cid }).first();
      await trx('members').insert({
        conversation_id: c.id,
        user_id: uid,
        joined_sequence: c.sequence,
        read_sequence: c.sequence,
      });
    }
    await trx('tokens').where({ hash: t.hash }).del();
  });
  res.status(201).json({ ok: true });
});
