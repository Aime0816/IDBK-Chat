import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import { db } from '../infrastructure/database.js';
import { hash } from '../infrastructure/core.js';
export function sockets(http: any) {
  const io = new Server(http, {
    maxHttpBufferSize: 10000,
    allowRequest: (req, cb) =>
      cb(null, req.headers.origin === (process.env.APP_ORIGIN || 'http://localhost:5173')),
  });
  io.use(async (socket, next) => {
    try {
      const raw = parseCookie(socket.request.headers.cookie || '').idbk_session;
      const s =
        raw &&
        (await db('sessions')
          .where({ hash: hash(raw) })
          .first());
      const u = s && (await db('users').where({ id: s.user_id, status: 'active' }).first());
      if (!u || Number(s.expires_at) < Date.now() || Number(s.last_seen) < Date.now() - 1800000)
        return next(new Error('Unauthorized'));
      socket.data.uid = u.id;
      socket.data.sessionHash = s.hash;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.uid}`);
  });
  return io;
}
