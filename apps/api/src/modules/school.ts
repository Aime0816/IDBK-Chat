import { Router } from 'express';
import { z } from 'zod';
import { db } from '../infrastructure/database.js';
import { id, ensure, audit, notify, secret, hash } from '../infrastructure/core.js';
import { active, roles } from '../middleware/auth.js';
import { classScope } from '../policies/access.js';
export const school = Router();
school.use(active);
export async function joinClass(trx: any, uid: string, cid: string) {
  await trx('enrolments').insert({ id: id(), user_id: uid, class_id: cid });
  const c = await trx('conversations').where({ class_id: cid }).first();
  ensure(c, 409, 'Class conversation missing');
  const m = await trx('members').where({ conversation_id: c.id, user_id: uid }).first();
  if (m)
    await trx('members')
      .where({ conversation_id: c.id, user_id: uid })
      .update({ left_at: null, joined_sequence: c.sequence, read_sequence: c.sequence });
  else
    await trx('members').insert({
      conversation_id: c.id,
      user_id: uid,
      joined_sequence: c.sequence,
      read_sequence: c.sequence,
    });
}
school.get('/classes', async (req, res) => {
  let q = db('classes').orderBy('year', 'desc').orderBy('name');
  if (!['admin', 'manager'].includes(req.user.role))
    q = q.whereIn('id', db('class_staff').where({ user_id: req.user.id }).select('class_id'));
  const list = await q;
  for (const c of list) {
    c.approved = Number(
      (
        await db('enrolments')
          .where({ class_id: c.id })
          .whereNull('ended_at')
          .count('* as n')
          .first()
      )?.n || 0,
    );
    c.pending = Number(
      (
        await db('applications')
          .where({ class_id: c.id, status: 'pending' })
          .count('* as n')
          .first()
      )?.n || 0,
    );
  }
  res.json(list);
});
school.post('/classes', roles('admin', 'manager'), async (req, res) => {
  const v = z
    .object({
      name: z.string().trim().min(2).max(100),
      programme: z.string().trim().min(2).max(80),
      year: z.string().min(4).max(30),
      expectedCount: z.number().int().min(1).max(1000),
    })
    .parse(req.body);
  const cid = id();
  await db.transaction(async (trx) => {
    await trx('classes').insert({
      id: cid,
      name: v.name,
      programme: v.programme,
      year: v.year,
      expected_count: v.expectedCount,
    });
    await trx('conversations').insert({
      id: id(),
      type: 'class',
      title: v.name,
      class_id: cid,
      created_at: Date.now(),
    });
    await audit(req.user.id, 'class.created', cid, v.name, trx);
  });
  res.status(201).json({ id: cid });
});
school.patch('/classes/:id', roles('admin', 'manager'), async (req, res) => {
  const v = z
    .object({
      expectedCount: z.number().int().min(1).max(1000),
      reason: z.string().min(5).max(500),
    })
    .parse(req.body);
  await db.transaction(async (trx) => {
    const c = await trx('classes').where({ id: req.params.id }).forUpdate().first();
    ensure(c, 404, 'Class not found');
    const count = (
      await trx('enrolments')
        .where({ class_id: c.id })
        .whereNull('ended_at')
        .forUpdate()
        .select('id')
    ).length;
    ensure(v.expectedCount >= count, 409, 'Count cannot be lower than current enrolment');
    await trx('classes').where({ id: c.id }).update({ expected_count: v.expectedCount });
    await audit(req.user.id, 'class.capacity', c.id, v.reason, trx);
  });
  res.json({ ok: true });
});
school.get('/applications', roles('admin', 'manager', 'teacher'), async (req, res) => {
  let q = db('applications as a')
    .join('users as u', 'u.id', 'a.user_id')
    .join('classes as c', 'c.id', 'a.class_id')
    .select('a.*', 'u.name', 'u.username', 'c.name as class_name')
    .orderBy('a.created_at', 'desc');
  if (req.user.role === 'teacher')
    q = q.whereIn(
      'a.class_id',
      db('class_staff').where({ user_id: req.user.id }).select('class_id'),
    );
  const rows = await q;
  for (const a of rows) {
    a.duplicate =
      Number(
        (
          await db('applications')
            .where({ claimed_number: a.claimed_number })
            .whereNot({ id: a.id })
            .count('* as n')
            .first()
        )?.n || 0,
      ) > 0 || !!(await db('student_identifiers').where({ number: a.claimed_number }).first());
  }
  res.json(rows);
});
school.post(
  '/applications/:id/decision',
  roles('admin', 'manager', 'teacher'),
  async (req, res) => {
    const v = z
      .object({
        decision: z.enum(['approve', 'reject', 'correction']),
        reason: z.string().trim().min(5).max(500),
        evidence: z.string().max(255).default(''),
      })
      .parse(req.body);
    await db.transaction(async (trx) => {
      const a = await trx('applications').where({ id: req.params.id }).forUpdate().first();
      ensure(a && a.status === 'pending', 409, 'Application is not pending');
      ensure(await classScope(req.user, a.class_id, trx), 403, 'Class not assigned');
      const c = await trx('classes').where({ id: a.class_id }).forUpdate().first();
      ensure(c && !c.archived, 409, 'Class is closed');
      if (v.decision === 'approve') {
        ensure(v.evidence.trim().length >= 5, 422, 'Record how the student was verified');
        ensure(
          !(await trx('student_identifiers').where({ number: a.claimed_number }).first()),
          409,
          'Student number is already verified for another account',
        );
        const count = (
          await trx('enrolments')
            .where({ class_id: c.id })
            .whereNull('ended_at')
            .forUpdate()
            .select('id')
        ).length;
        ensure(
          count < c.expected_count,
          409,
          'Class is full. Reconcile the expected count before approving.',
        );
        await trx('student_identifiers').insert({ number: a.claimed_number, user_id: a.user_id });
        await joinClass(trx, a.user_id, c.id);
        await trx('users').where({ id: a.user_id }).update({ status: 'active' });
      } else
        await trx('users')
          .where({ id: a.user_id })
          .update({ status: v.decision === 'reject' ? 'rejected' : 'pending' });
      await trx('applications')
        .where({ id: a.id })
        .update({
          status:
            v.decision === 'approve'
              ? 'approved'
              : v.decision === 'reject'
                ? 'rejected'
                : 'correction',
          reason: v.reason,
          evidence: v.evidence,
          reviewer_id: req.user.id,
        });
      await audit(req.user.id, 'application.' + v.decision, a.id, JSON.stringify(v), trx);
      await notify(a.user_id, 'Your application has been reviewed', '/', trx);
    });
    res.json({ ok: true });
  },
);
school.get('/users', roles('admin', 'manager'), async (_req, res) =>
  res.json(
    await db('users')
      .select('id', 'name', 'username', 'role', 'status', 'created_at')
      .orderBy('name'),
  ),
);
school.post('/users/:id/status', roles('admin', 'manager'), async (req, res) => {
  const v = z
    .object({ status: z.enum(['active', 'suspended']), reason: z.string().min(5).max(500) })
    .parse(req.body);
  const u = await db('users').where({ id: req.params.id }).first();
  ensure(
    u && u.id !== req.user.id && u.role !== 'admin',
    403,
    'This account cannot be changed here',
  );
  ensure(
    ['active', 'suspended'].includes(u.status),
    409,
    'Use application review for pending accounts',
  );
  await db.transaction(async (trx) => {
    await trx('users').where({ id: u.id }).update({ status: v.status });
    await trx('sessions').where({ user_id: u.id }).del();
    await audit(req.user.id, 'user.' + v.status, u.id, v.reason, trx);
  });
  res.json({ ok: true });
});
school.post('/users/:id/transfer', roles('admin', 'manager'), async (req, res) => {
  const v = z.object({ classId: z.uuid(), reason: z.string().min(5).max(500) }).parse(req.body);
  await db.transaction(async (trx) => {
    const u = await trx('users')
      .where({ id: req.params.id, role: 'student', status: 'active' })
      .forUpdate()
      .first();
    ensure(u, 404, 'Active student not found');
    const old = await trx('enrolments').where({ user_id: u.id }).whereNull('ended_at');
    ensure(!old.some((e) => e.class_id === v.classId), 409, 'Already enrolled');
    const ids = [v.classId, ...old.map((e) => e.class_id)].sort();
    await trx('classes').whereIn('id', ids).orderBy('id').forUpdate();
    const c = await trx('classes').where({ id: v.classId, archived: false }).first();
    ensure(c, 404, 'Open class not found');
    ensure(
      (
        await trx('enrolments')
          .where({ class_id: c.id })
          .whereNull('ended_at')
          .forUpdate()
          .select('id')
      ).length < c.expected_count,
      409,
      'Destination class is full',
    );
    for (const e of old) {
      await trx('enrolments').where({ id: e.id }).update({ ended_at: Date.now() });
      const conv = await trx('conversations').where({ class_id: e.class_id }).first();
      await trx('members')
        .where({ conversation_id: conv.id, user_id: u.id })
        .update({ left_at: Date.now() });
    }
    await joinClass(trx, u.id, c.id);
    await audit(req.user.id, 'enrolment.transfer', u.id, v.reason, trx);
    await notify(u.id, 'Your class membership has changed', '/chats', trx);
  });
  res.json({ ok: true });
});
school.post('/staff-invitations', roles('admin'), async (req, res) => {
  const v = z
    .object({
      email: z.email(),
      role: z.enum(['teacher', 'manager']),
      classIds: z.array(z.uuid()).default([]),
    })
    .parse(req.body);
  ensure(
    !(await db('users').where({ email: v.email.toLowerCase() }).first()),
    409,
    'Email already registered',
  );
  for (const cid of v.classIds)
    ensure(await db('classes').where({ id: cid, archived: false }).first(), 422, 'Invalid class');
  const token = secret();
  await db('tokens').insert({
    hash: hash(token),
    kind: 'staff',
    payload: JSON.stringify({ ...v, email: v.email.toLowerCase() }),
    expires_at: Date.now() + 48 * 3600000,
  });
  await audit(req.user.id, 'staff.invited', v.email, v.role);
  res.json({ link: `${process.env.APP_ORIGIN || 'http://localhost:5173'}/invite?token=${token}` });
});
school.get('/audit', roles('admin'), async (_req, res) =>
  res.json(await db('audit_logs').orderBy('created_at', 'desc').limit(200)),
);
school.post('/classes/:id/teacher', roles('admin', 'manager'), async (req, res) => {
  const v = z.object({ userId: z.uuid(), remove: z.boolean().default(false) }).parse(req.body);
  await db.transaction(async (trx) => {
    const c = await trx('classes')
      .where({ id: req.params.id, archived: false })
      .forUpdate()
      .first();
    ensure(c, 404, 'Open class not found');
    ensure(
      await trx('users').where({ id: v.userId, role: 'teacher', status: 'active' }).first(),
      422,
      'Select an active teacher',
    );
    const conv = await trx('conversations').where({ class_id: c.id }).first();
    if (v.remove) {
      await trx('class_staff').where({ class_id: c.id, user_id: v.userId }).del();
      await trx('members')
        .where({ conversation_id: conv.id, user_id: v.userId })
        .update({ left_at: Date.now() });
    } else {
      if (await trx('class_staff').where({ class_id: c.id, user_id: v.userId }).first()) return;
      await trx('class_staff')
        .insert({ class_id: c.id, user_id: v.userId })
        .onConflict(['class_id', 'user_id'])
        .ignore();
      await trx('members')
        .insert({
          conversation_id: conv.id,
          user_id: v.userId,
          joined_sequence: conv.sequence,
          read_sequence: conv.sequence,
        })
        .onConflict(['conversation_id', 'user_id'])
        .merge({ left_at: null, joined_sequence: conv.sequence, read_sequence: conv.sequence });
    }
    await audit(
      req.user.id,
      v.remove ? 'teacher.unassigned' : 'teacher.assigned',
      c.id,
      v.userId,
      trx,
    );
    await notify(v.userId, 'Your class assignment changed', '/chats', trx);
  });
  res.json({ ok: true });
});
school.post('/classes/:id/archive', roles('admin', 'manager'), async (req, res) => {
  const v = z.object({ reason: z.string().min(5).max(500) }).parse(req.body);
  await db.transaction(async (trx) => {
    const c = await trx('classes')
      .where({ id: req.params.id, archived: false })
      .forUpdate()
      .first();
    ensure(c, 404, 'Open class not found');
    const conv = await trx('conversations').where({ class_id: c.id }).first();
    await trx('classes').where({ id: c.id }).update({ archived: true });
    await trx('enrolments')
      .where({ class_id: c.id })
      .whereNull('ended_at')
      .update({ ended_at: Date.now() });
    await trx('members').where({ conversation_id: conv.id }).update({ left_at: Date.now() });
    await trx('conversations').where({ id: conv.id }).update({ archived: true });
    await trx('class_staff').where({ class_id: c.id }).del();
    await audit(req.user.id, 'class.archived', c.id, v.reason, trx);
  });
  res.json({ ok: true });
});
