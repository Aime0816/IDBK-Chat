import type { Request, Response, NextFunction } from 'express';
import { db } from '../infrastructure/database.js';
import { hash, ensure } from '../infrastructure/core.js';
declare global {
  namespace Express {
    interface Request {
      user: any;
      session: any;
    }
  }
}
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const raw = req.cookies?.idbk_session;
  if (raw) {
    const s = await db('sessions')
      .where({ hash: hash(raw) })
      .first();
    if (
      s &&
      Number(s.expires_at) > Date.now() &&
      Number(s.last_seen) > Date.now() - 30 * 60 * 1000
    ) {
      const u = await db('users').where({ id: s.user_id }).first();
      if (u && !['suspended', 'closed'].includes(u.status)) {
        req.user = u;
        req.session = s;
        await db('sessions').where({ hash: s.hash }).update({ last_seen: Date.now() });
      }
    }
  }
  next();
}
export function signed(req: Request, _res: Response, next: NextFunction) {
  ensure(req.user, 401, 'Please sign in');
  next();
}
export function active(req: Request, _res: Response, next: NextFunction) {
  ensure(req.user, 401, 'Please sign in');
  ensure(req.user.status === 'active', 403, 'Your account is awaiting approval or is unavailable');
  next();
}
export function roles(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    ensure(req.user && allowed.includes(req.user.role), 403, 'You do not have permission');
    next();
  };
}
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin)
      ensure(
        origin === (process.env.APP_ORIGIN || 'http://localhost:5173'),
        403,
        'Untrusted origin',
      );
    if (req.session)
      ensure(
        req.get('x-csrf-token') === req.session.csrf,
        403,
        'Invalid security token. Refresh and retry.',
      );
  }
  next();
}
