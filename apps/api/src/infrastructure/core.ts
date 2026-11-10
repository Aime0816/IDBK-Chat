import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { db } from './database.js';
export const id = () => randomUUID();
export const secret = () => randomBytes(32).toString('hex');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(condition: any, status: number, message: string): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export async function audit(
  actor: string | null,
  action: string,
  target: string,
  detail: string,
  trx: any = db,
) {
  await trx('audit_logs').insert({
    id: id(),
    actor_id: actor,
    action,
    target_id: target,
    detail,
    created_at: Date.now(),
  });
}
export async function notify(user: string, title: string, link = '/', trx: any = db) {
  await trx('notifications').insert({
    id: id(),
    user_id: user,
    title,
    link,
    is_read: false,
    created_at: Date.now(),
  });
  await event(user, 'refresh', trx);
}
export async function event(user: string, name = 'refresh', trx: any = db) {
  await trx('outbox').insert({ id: id(), user_id: user, event: name, created_at: Date.now() });
}
export const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  email_verified: !!u.email_verified,
  role: u.role,
  status: u.status,
});
