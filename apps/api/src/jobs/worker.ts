import { db } from '../infrastructure/database.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { storageRoot } from '../infrastructure/storage.js';
export function startWorker(io: any) {
  let running = false,
    ticks = 0;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      // Events contain invalidation only, never private message text. APIs reauthorize content.
      for (const [, s] of io.sockets.sockets) {
        const session = await db('sessions').where({ hash: s.data.sessionHash }).first();
        const u = await db('users').where({ id: s.data.uid, status: 'active' }).first();
        if (
          !session ||
          !u ||
          Number(session.expires_at) < Date.now() ||
          Number(session.last_seen) < Date.now() - 1800000
        )
          s.disconnect(true);
      }
      for (const e of await db('outbox')
        .whereNull('delivered_at')
        .orderBy('created_at')
        .limit(100)) {
        io.to(`user:${e.user_id}`).emit('refresh', { eventId: e.id });
        await db('outbox').where({ id: e.id }).update({ delivered_at: Date.now() });
      }
      if (++ticks % 300 === 0) {
        await db('sessions').where('expires_at', '<', Date.now()).del();
        await db('tokens').where('expires_at', '<', Date.now()).del();
        await db('outbox')
          .where('delivered_at', '<', Date.now() - 7 * 86400000)
          .del();
        for (const a of await db('attachments')
          .whereNull('message_id')
          .where('created_at', '<', Date.now() - 86400000)) {
          await fs.rm(path.join(storageRoot, a.id), { force: true });
          await db('attachments').where({ id: a.id }).del();
        }
      }
    } catch (e) {
      console.error('Background processing failed', e instanceof Error ? e.message : 'unknown');
    } finally {
      running = false;
    }
  }, 1000);
  return () => clearInterval(timer);
}
