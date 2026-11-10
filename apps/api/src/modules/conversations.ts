import { Router } from 'express';
import { z } from 'zod';
import { db } from '../infrastructure/database.js';
import { id, ensure, notify, audit } from '../infrastructure/core.js';
import { active } from '../middleware/auth.js';
import { member, blocked } from '../policies/access.js';
export const conversations = Router();
conversations.use(active);
conversations.get('/directory', async (req, res) => {
  const term = String(req.query.q || '')
    .trim()
    .slice(0, 60);
  ensure(term.length >= 2, 422, 'Enter at least two characters');
  res.json(
    await db('users')
      .where({ status: 'active' })
      .whereNot({ id: req.user.id })
      .where('name', 'like', `%${term.replace(/[%_]/g, '')}%`)
      .select('id', 'name', 'role')
      .limit(30),
  );
});
conversations.get('/invitations', async (req, res) =>
  res.json(
    await db('invitations as i')
      .join('conversations as c', 'c.id', 'i.conversation_id')
      .join('users as u', 'u.id', 'i.sender_id')
      .where({ 'i.recipient_id': req.user.id, 'i.status': 'pending' })
      .select('i.*', 'c.title', 'c.type', 'u.name as sender'),
  ),
);
conversations.post('/invitations/:id', async (req, res) => {
  const v = z.object({ accept: z.boolean() }).parse(req.body);
  await db.transaction(async (trx) => {
    const i = await trx('invitations')
      .where({ id: req.params.id, recipient_id: req.user.id, status: 'pending' })
      .forUpdate()
      .first();
    ensure(i, 404, 'Invitation not found');
    ensure(!(await blocked(req.user.id, i.sender_id, trx)), 403, 'Contact is blocked');
    const c = await trx('conversations')
      .where({ id: i.conversation_id, archived: false })
      .forUpdate()
      .first();
    ensure(c, 404, 'Group no longer available');
    ensure(
      await trx('members')
        .where({ conversation_id: c.id, user_id: i.sender_id })
        .whereNull('left_at')
        .first(),
      409,
      'Inviter is no longer a member',
    );
    if (v.accept) {
      const count = (
        await trx('members')
          .where({ conversation_id: c.id })
          .whereNull('left_at')
          .forUpdate()
          .select('user_id')
      ).length;
      ensure(count < 50, 409, 'Group is full');
      const existing = await trx('members')
        .where({ conversation_id: c.id, user_id: req.user.id })
        .first();
      const vals = { joined_sequence: c.sequence, read_sequence: c.sequence, left_at: null };
      if (existing)
        await trx('members').where({ conversation_id: c.id, user_id: req.user.id }).update(vals);
      else await trx('members').insert({ conversation_id: c.id, user_id: req.user.id, ...vals });
    }
    await trx('invitations')
      .where({ id: i.id })
      .update({ status: v.accept ? 'accepted' : 'declined' });
    await notify(
      i.sender_id,
      `${req.user.name} ${v.accept ? 'accepted' : 'declined'} your invitation`,
      '/chats',
      trx,
    );
  });
  res.json({ ok: true });
});
conversations.get('/', async (req, res) => {
  const rows = await db('conversations as c')
    .join('members as m', 'm.conversation_id', 'c.id')
    .where({ 'm.user_id': req.user.id })
    .whereNull('m.left_at')
    .select('c.*', 'm.read_sequence', 'm.joined_sequence');
  for (const c of rows) {
    const members = await db('members as m')
      .join('users as u', 'u.id', 'm.user_id')
      .where({ 'm.conversation_id': c.id })
      .whereNull('m.left_at')
      .select('u.id', 'u.name', 'u.role');
    c.members = members;
    if (c.type === 'direct')
      c.title = members.find((m) => m.id !== req.user.id)?.name || 'Pending direct conversation';
    c.last = await db('messages')
      .where({ conversation_id: c.id })
      .where('sequence', '>', c.joined_sequence)
      .orderBy('sequence', 'desc')
      .select('body', 'created_at', 'deleted_at')
      .first();
    if (c.last?.deleted_at) c.last.body = 'Message removed';
    c.unread = Number(
      (
        await db('messages')
          .where({ conversation_id: c.id })
          .where('sequence', '>', Math.max(c.read_sequence, c.joined_sequence))
          .whereNot({ sender_id: req.user.id })
          .count('* as n')
          .first()
      )?.n || 0,
    );
  }
  res.json(
    rows.sort(
      (a, b) =>
        Number(b.last?.created_at || b.created_at) - Number(a.last?.created_at || a.created_at),
    ),
  );
});
conversations.post('/', async (req, res) => {
  const v = z.object({ title: z.string().trim().min(2).max(100) }).parse(req.body);
  const cid = id();
  await db.transaction(async (trx) => {
    await trx('conversations').insert({
      id: cid,
      type: 'group',
      title: v.title,
      owner_id: req.user.id,
      created_at: Date.now(),
    });
    await trx('members').insert({ conversation_id: cid, user_id: req.user.id });
  });
  res.status(201).json({ id: cid });
});
conversations.post('/direct', async (req, res) => {
  const v = z.object({ userId: z.uuid() }).parse(req.body);
  ensure(v.userId !== req.user.id, 422, 'Select another member');
  ensure(
    await db('users').where({ id: v.userId, status: 'active' }).first(),
    404,
    'Member not found',
  );
  ensure(!(await blocked(req.user.id, v.userId)), 403, 'Contact is blocked');
  const pair = [req.user.id, v.userId].sort().join(':');
  let result: any;
  await db.transaction(async (trx) => {
    await trx('users').whereIn('id', [req.user.id, v.userId]).orderBy('id').forUpdate();
    let c = await trx('conversations').where({ pair_key: pair }).first();
    if (!c) {
      c = {
        id: id(),
        type: 'direct',
        title: 'Direct conversation',
        pair_key: pair,
        owner_id: req.user.id,
        created_at: Date.now(),
      };
      await trx('conversations').insert(c);
      await trx('members').insert({ conversation_id: c.id, user_id: req.user.id });
    }
    const targetMember = await trx('members')
      .where({ conversation_id: c.id, user_id: v.userId })
      .whereNull('left_at')
      .first();
    if (!targetMember) {
      const mine = await trx('members')
        .where({ user_id: req.user.id })
        .whereNull('left_at')
        .select('conversation_id');
      const shared = await trx('members as m')
        .join('conversations as c', 'c.id', 'm.conversation_id')
        .where({ 'm.user_id': v.userId, 'c.type': 'class' })
        .whereNull('m.left_at')
        .whereIn(
          'm.conversation_id',
          mine.map((x) => x.conversation_id),
        )
        .first();
      if (shared) await trx('members').insert({ conversation_id: c.id, user_id: v.userId });
      else {
        const i = await trx('invitations')
          .where({ conversation_id: c.id, recipient_id: v.userId })
          .first();
        ensure(!i || i.status === 'pending', 409, 'The invitation was declined');
        if (!i) {
          await trx('invitations').insert({
            id: id(),
            conversation_id: c.id,
            sender_id: req.user.id,
            recipient_id: v.userId,
          });
          await notify(v.userId, 'New message request', '/chats', trx);
        }
      }
    }
    result = { id: c.id };
  });
  res.json(result);
});
conversations.post('/:id/invite', async (req, res) => {
  const v = z.object({ userId: z.uuid() }).parse(req.body);
  const c = await member(req.user, String(req.params.id));
  ensure(
    c.type === 'group' && c.owner_id === req.user.id && !c.archived,
    403,
    'Only the group owner may invite',
  );
  ensure(!(await blocked(req.user.id, v.userId)), 403, 'Contact is blocked');
  ensure(
    await db('users').where({ id: v.userId, status: 'active' }).first(),
    404,
    'Member not found',
  );
  ensure(
    !(await db('members')
      .where({ conversation_id: c.id, user_id: v.userId })
      .whereNull('left_at')
      .first()),
    409,
    'Already a member',
  );
  ensure(
    !(await db('invitations').where({ conversation_id: c.id, recipient_id: v.userId }).first()),
    409,
    'Invitation already exists',
  );
  await db('invitations').insert({
    id: id(),
    conversation_id: c.id,
    sender_id: req.user.id,
    recipient_id: v.userId,
  });
  await notify(v.userId, `Invitation to ${c.title}`, '/chats');
  res.json({ ok: true });
});
conversations.post('/:id/leave', async (req, res) => {
  await db.transaction(async (trx) => {
    const c = await member(req.user, String(req.params.id), trx);
    ensure(c.type === 'group', 403, 'Only student groups may be left');
    if (c.owner_id === req.user.id) {
      const others = await trx('members')
        .where({ conversation_id: c.id })
        .whereNull('left_at')
        .whereNot({ user_id: req.user.id });
      if (others.length) {
        ensure(
          req.body.successorId && others.some((m) => m.user_id === req.body.successorId),
          422,
          'Choose another member to own the group',
        );
        await trx('conversations').where({ id: c.id }).update({ owner_id: req.body.successorId });
      } else await trx('conversations').where({ id: c.id }).update({ archived: true });
    }
    await trx('members')
      .where({ conversation_id: c.id, user_id: req.user.id })
      .update({ left_at: Date.now() });
    await audit(req.user.id, 'group.left', c.id, 'Membership ended', trx);
  });
  res.json({ ok: true });
});
conversations.post('/:id/remove', async (req, res) => {
  const v = z.object({ userId: z.uuid() }).parse(req.body);
  const c = await member(req.user, String(req.params.id));
  ensure(
    c.type === 'group' && c.owner_id === req.user.id && v.userId !== req.user.id,
    403,
    'Not permitted',
  );
  await db('members')
    .where({ conversation_id: c.id, user_id: v.userId })
    .update({ left_at: Date.now() });
  await notify(v.userId, 'A group membership has ended', '/chats');
  res.json({ ok: true });
});
conversations.post('/:id/read', async (req, res) => {
  const c = await member(req.user, String(req.params.id));
  const seq = Math.min(c.sequence, Math.max(0, Number(req.body.sequence) || 0));
  await db('members')
    .where({ conversation_id: c.id, user_id: req.user.id })
    .where('read_sequence', '<', seq)
    .update({ read_sequence: seq });
  res.json({ ok: true });
});
