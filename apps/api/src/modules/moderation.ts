import { Router } from 'express';
import { z } from 'zod';
import { db } from '../infrastructure/database.js';
import { id, ensure, audit, notify, event } from '../infrastructure/core.js';
import { active, roles } from '../middleware/auth.js';
import { member, classScope } from '../policies/access.js';
export const moderation = Router();
moderation.use(active);
moderation.get('/blocks', async (req, res) =>
  res.json(
    await db('blocks as b')
      .join('users as u', 'u.id', 'b.target_id')
      .where({ 'b.user_id': req.user.id })
      .select('u.id', 'u.name'),
  ),
);
moderation.post('/blocks/:id', async (req, res) => {
  const target = String(req.params.id);
  ensure(
    target !== req.user.id && (await db('users').where({ id: target }).first()),
    422,
    'Invalid member',
  );
  await db('blocks')
    .insert({ user_id: req.user.id, target_id: target })
    .onConflict(['user_id', 'target_id'])
    .ignore();
  res.json({ ok: true });
});
moderation.delete('/blocks/:id', async (req, res) => {
  await db('blocks').where({ user_id: req.user.id, target_id: req.params.id }).del();
  res.json({ ok: true });
});
moderation.post('/reports', async (req, res) => {
  const v = z
    .object({ messageId: z.uuid(), reason: z.string().trim().min(5).max(1000) })
    .parse(req.body);
  const m = await db('messages').where({ id: v.messageId }).first();
  ensure(m, 404, 'Message not found');
  const c = await member(req.user, m.conversation_id);
  ensure(m.sequence > c.membership.joined_sequence, 404, 'Message not accessible');
  const context = await db('messages as m')
    .join('users as u', 'u.id', 'm.sender_id')
    .where('m.conversation_id', c.id)
    .whereBetween('m.sequence', [
      Math.max(m.sequence - 2, c.membership.joined_sequence + 1),
      m.sequence + 2,
    ])
    .select('m.id', 'm.body', 'm.sender_id', 'u.name', 'm.created_at');
  await db('reports').insert({
    id: id(),
    reporter_id: req.user.id,
    message_id: m.id,
    class_id: c.class_id,
    reason: v.reason,
    evidence: JSON.stringify(context),
    created_at: Date.now(),
  });
  res.status(201).json({ ok: true });
});
moderation.get('/reports', roles('teacher', 'manager', 'admin'), async (req, res) => {
  let q = db('reports').orderBy('created_at', 'desc');
  if (req.user.role === 'teacher')
    q = q.whereIn('class_id', db('class_staff').where({ user_id: req.user.id }).select('class_id'));
  res.json((await q.limit(200)).map((r) => ({ ...r, evidence: JSON.parse(r.evidence) })));
});
moderation.post('/reports/:id/resolve', roles('teacher', 'manager', 'admin'), async (req, res) => {
  const v = z
    .object({ action: z.enum(['dismiss', 'hide']), reason: z.string().min(5).max(1000) })
    .parse(req.body);
  const r = await db('reports').where({ id: req.params.id }).first();
  ensure(r && (await classScope(req.user, r.class_id)), 403, 'Report not assigned to your scope');
  await db.transaction(async (trx) => {
    await trx('reports').where({ id: r.id }).update({ status: 'resolved', resolution: v.reason });
    if (v.action === 'hide') {
      const m = await trx('messages').where({ id: r.message_id }).first();
      await trx('messages').where({ id: r.message_id }).update({ deleted_at: Date.now() });
      for (const p of await trx('members')
        .where({ conversation_id: m.conversation_id })
        .whereNull('left_at'))
        await event(p.user_id, 'refresh', trx);
    }
    await audit(req.user.id, 'report.' + v.action, r.id, v.reason, trx);
    await notify(r.reporter_id, 'Your report has been reviewed', '/', trx);
  });
  res.json({ ok: true });
});
moderation.get('/notifications', async (req, res) =>
  res.json(
    await db('notifications')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(100),
  ),
);
moderation.post('/notifications/read', async (req, res) => {
  await db('notifications').where({ user_id: req.user.id }).update({ is_read: true });
  res.json({ ok: true });
});
