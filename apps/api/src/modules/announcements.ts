import { Router } from 'express';
import { db } from '../infrastructure/database.js';
import { id, ensure, audit, notify } from '../infrastructure/core.js';
import { active, roles } from '../middleware/auth.js';
import { classScope, noticeAccess } from '../policies/access.js';
import { noticeSchema } from '../../../../packages/contracts/src/index.js';
export const announcements = Router();
announcements.use(active);
announcements.get('/', async (req, res) => {
  const list = await db('announcements as a')
    .join('users as u', 'u.id', 'a.publisher_id')
    .leftJoin('classes as c', 'c.id', 'a.class_id')
    .select('a.*', 'u.name as publisher', 'u.role as publisher_role', 'c.name as class_name')
    .orderBy('a.created_at', 'desc')
    .limit(200);
  const out: any[] = [];
  for (const n of list)
    if (await noticeAccess(req.user, n)) {
      const r = await db('recipients')
        .where({ announcement_id: n.id, revision: n.revision, user_id: req.user.id })
        .first();
      n.acknowledged = !!r?.acknowledged_at;
      n.can_ack = !!r;
      n.expired = !!n.expires_at && Number(n.expires_at) < Date.now();
      if (n.publisher_id === req.user.id || ['admin', 'manager'].includes(req.user.role)) {
        n.recipient_count = Number(
          (
            await db('recipients')
              .where({ announcement_id: n.id, revision: n.revision })
              .count('* as n')
              .first()
          )?.n || 0,
        );
        n.ack_count = Number(
          (
            await db('recipients')
              .where({ announcement_id: n.id, revision: n.revision })
              .whereNotNull('acknowledged_at')
              .count('* as n')
              .first()
          )?.n || 0,
        );
      }
      out.push(n);
    }
  res.json(out);
});
async function save(req: any, res: any) {
  const v = noticeSchema.parse(req.body);
  ensure(await classScope(req.user, v.classId), 403, 'Audience not permitted');
  if (v.classId)
    ensure(
      await db('classes').where({ id: v.classId, archived: false }).first(),
      422,
      'Class is not open',
    );
  const nid = req.params.id || id();
  await db.transaction(async (trx) => {
    const old = await trx('announcements').where({ id: nid }).forUpdate().first();
    if (req.params.id)
      ensure(
        old && (old.publisher_id === req.user.id || req.user.role === 'admin'),
        403,
        'Cannot edit this announcement',
      );
    ensure(
      !old || old.status !== 'published' || v.status === 'published',
      409,
      'Published notices cannot become drafts',
    );
    const rev = old ? old.revision + 1 : 1;
    const value = {
      publisher_id: old?.publisher_id || req.user.id,
      class_id: v.classId,
      title: v.title,
      body: v.body,
      priority: v.priority,
      requires_ack: v.requiresAck,
      status: v.status,
      expires_at: v.expiresAt || null,
      revision: rev,
      created_at: old?.created_at || Date.now(),
    };
    if (old) await trx('announcements').where({ id: nid }).update(value);
    else await trx('announcements').insert({ id: nid, ...value });
    if (v.status === 'published') {
      await trx('announcement_revisions').insert({
        announcement_id: nid,
        revision: rev,
        content: JSON.stringify(value),
        published_at: Date.now(),
      });
      let users;
      if (v.classId) {
        const e = await trx('enrolments')
          .where({ class_id: v.classId })
          .whereNull('ended_at')
          .select('user_id');
        const staff = await trx('class_staff').where({ class_id: v.classId }).select('user_id');
        users = await trx('users')
          .whereIn(
            'id',
            [...e, ...staff].map((x) => x.user_id),
          )
          .where({ status: 'active' });
      } else users = await trx('users').where({ status: 'active' });
      for (const u of users) {
        await trx('recipients').insert({ announcement_id: nid, revision: rev, user_id: u.id });
        await notify(u.id, v.title, '/announcements', trx);
      }
    }
    await audit(req.user.id, 'announcement.' + v.status, nid, `Revision ${rev}`, trx);
  });
  res.json({ id: nid });
}
announcements.post('/', roles('teacher', 'manager', 'admin'), save);
announcements.put('/:id', roles('teacher', 'manager', 'admin'), save);
announcements.post('/:id/ack', async (req, res) => {
  const n = await db('announcements').where({ id: req.params.id, status: 'published' }).first();
  ensure(await noticeAccess(req.user, n), 404, 'Announcement not found');
  ensure(n.requires_ack, 422, 'Acknowledgement not requested');
  ensure(
    Number(req.body.revision) === n.revision,
    409,
    'Announcement changed. Refresh before acknowledging.',
  );
  const r = await db('recipients')
    .where({ announcement_id: n.id, revision: n.revision, user_id: req.user.id })
    .first();
  ensure(r, 403, 'You were not in this revision’s acknowledgement audience');
  await db('recipients')
    .where({ announcement_id: n.id, revision: n.revision, user_id: req.user.id })
    .whereNull('acknowledged_at')
    .update({ acknowledged_at: Date.now() });
  res.json({ ok: true });
});
