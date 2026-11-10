import { db } from '../infrastructure/database.js';
import { ensure } from '../infrastructure/core.js';
export async function classScope(user: any, classId: string | null, trx: any = db) {
  if (['admin', 'manager'].includes(user.role)) return true;
  if (!classId || user.role !== 'teacher') return false;
  return !!(await trx('class_staff').where({ user_id: user.id, class_id: classId }).first());
}
export async function member(user: any, cid: string, trx: any = db) {
  const c = await trx('conversations').where({ id: cid }).first();
  const m = await trx('members')
    .where({ conversation_id: cid, user_id: user.id })
    .whereNull('left_at')
    .first();
  ensure(c && m, 404, 'Conversation not found');
  return { ...c, membership: m };
}
export async function blocked(a: string, b: string, trx: any = db) {
  return !!(await trx('blocks')
    .where((q) => q.where({ user_id: a, target_id: b }).orWhere({ user_id: b, target_id: a }))
    .first());
}
export async function noticeAccess(user: any, n: any, trx: any = db) {
  if (!n) return false;
  if (n.publisher_id === user.id || ['admin', 'manager'].includes(user.role)) return true;
  if (n.status !== 'published') return false;
  if (!n.class_id) return true;
  return (
    !!(await trx('enrolments')
      .where({ class_id: n.class_id, user_id: user.id })
      .whereNull('ended_at')
      .first()) ||
    !!(await trx('class_staff').where({ class_id: n.class_id, user_id: user.id }).first())
  );
}
