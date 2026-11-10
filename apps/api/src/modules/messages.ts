import { Router } from 'express';
import { db } from '../infrastructure/database.js';
import { id, ensure, hash, event } from '../infrastructure/core.js';
import { active } from '../middleware/auth.js';
import { member, blocked } from '../policies/access.js';
import { messageSchema } from '../../../../packages/contracts/src/index.js';
import { z } from 'zod';
export const messages = Router();
messages.use(active);
messages.get('/:cid', async (req, res) => {
  const c = await member(req.user, String(req.params.cid));
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  const after = Number(req.query.after) || 0;
  let q = db('messages as m')
    .join('users as u', 'u.id', 'm.sender_id')
    .where('m.conversation_id', c.id)
    .where('m.sequence', '>', Math.max(after, c.membership.joined_sequence))
    .where('m.sequence', '<', before)
    .select('m.*', 'u.name as sender_name', 'u.role as sender_role');
  const rows = await q.orderBy('m.sequence', after ? 'asc' : 'desc').limit(50);
  if (!after) rows.reverse();
  for (const m of rows) {
    m.attachments = m.deleted_at
      ? []
      : await db('attachments').where({ message_id: m.id }).select('id', 'name', 'mime', 'size');
    if (m.deleted_at) m.body = 'Message removed';
    delete m.payload_hash;
    if (m.reply_to) {
      const reply = await db('messages')
        .where({ id: m.reply_to, conversation_id: c.id })
        .where('sequence', '>', c.membership.joined_sequence)
        .first();
      m.reply_preview = reply
        ? reply.deleted_at
          ? 'Message removed'
          : reply.body.slice(0, 100)
        : 'Earlier message';
    }
  }
  res.json({ messages: rows, hasMore: rows.length === 50 });
});
messages.post('/:cid', async (req, res) => {
  const v = messageSchema.parse(req.body);
  const cid = String(req.params.cid);
  const fingerprint = hash(JSON.stringify({ cid, ...v }));
  let saved: any;
  await db.transaction(async (trx) => {
    await trx('conversations').where({ id: cid }).forUpdate().first();
    const c = await member(req.user, cid, trx);
    ensure(!c.archived, 409, 'Conversation is archived');
    const prior = await trx('messages')
      .where({ sender_id: req.user.id, client_id: v.clientId })
      .first();
    if (prior) {
      ensure(
        prior.payload_hash === fingerprint,
        409,
        'Message key was reused with different content',
      );
      saved = prior;
      return;
    }
    const recipients = await trx('members').where({ conversation_id: cid }).whereNull('left_at');
    if (c.type === 'direct') {
      ensure(recipients.length === 2, 403, 'Wait for the recipient to accept your request');
      const other = recipients.find((m) => m.user_id !== req.user.id);
      ensure(!(await blocked(req.user.id, other.user_id, trx)), 403, 'Direct contact is blocked');
    }
    if (v.replyTo)
      ensure(
        await trx('messages')
          .where({ id: v.replyTo, conversation_id: cid })
          .where('sequence', '>', c.membership.joined_sequence)
          .first(),
        422,
        'Reply target unavailable',
      );
    for (const aid of v.attachmentIds)
      ensure(
        await trx('attachments')
          .where({ id: aid, uploader_id: req.user.id })
          .whereNull('message_id')
          .forUpdate()
          .first(),
        422,
        'Attachment unavailable',
      );
    saved = {
      id: id(),
      conversation_id: cid,
      sender_id: req.user.id,
      client_id: v.clientId,
      payload_hash: fingerprint,
      sequence: c.sequence + 1,
      body: v.body,
      reply_to: v.replyTo || null,
      created_at: Date.now(),
    };
    await trx('messages').insert(saved);
    await trx('conversations').where({ id: cid }).update({ sequence: saved.sequence });
    if (v.attachmentIds.length)
      await trx('attachments').whereIn('id', v.attachmentIds).update({ message_id: saved.id });
    for (const m of recipients) await event(m.user_id, 'refresh', trx);
  });
  res.status(201).json({ id: saved.id, sequence: saved.sequence, created_at: saved.created_at });
});
messages.patch('/item/:id', async (req, res) => {
  const v = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
  const m = await db('messages').where({ id: req.params.id }).first();
  ensure(m, 404, 'Message not found');
  await member(req.user, m.conversation_id);
  ensure(
    m.sender_id === req.user.id && !m.deleted_at && Date.now() - Number(m.created_at) < 900000,
    403,
    'Editing is allowed for 15 minutes',
  );
  await db.transaction(async (trx) => {
    await trx('messages').where({ id: m.id }).update({ body: v.body, edited_at: Date.now() });
    for (const p of await trx('members')
      .where({ conversation_id: m.conversation_id })
      .whereNull('left_at'))
      await event(p.user_id, 'refresh', trx);
  });
  res.json({ ok: true });
});
messages.delete('/item/:id', async (req, res) => {
  const m = await db('messages').where({ id: req.params.id }).first();
  ensure(m, 404, 'Message not found');
  await member(req.user, m.conversation_id);
  ensure(
    m.sender_id === req.user.id && Date.now() - Number(m.created_at) < 900000,
    403,
    'Removing is allowed for 15 minutes',
  );
  await db.transaction(async (trx) => {
    await trx('messages').where({ id: m.id }).update({ deleted_at: Date.now() });
    for (const p of await trx('members')
      .where({ conversation_id: m.conversation_id })
      .whereNull('left_at'))
      await event(p.user_id, 'refresh', trx);
  });
  res.json({ ok: true });
});
