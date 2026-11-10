import { useState } from 'react';
import { Plus, Users, CheckCircle, ClipboardList, Shield, AlertTriangle } from 'lucide-react';
import {
  useData,
  Loading,
  ErrorBox,
  Modal,
  ActionForm,
  Field,
  Badge,
  ButtonAction,
  date,
  Empty,
} from '../components/ui';
import { post, patch } from '../lib/api';
export function Admin({ user }: { user: any }) {
  const [tab, setTab] = useState('applications'),
    [modal, setModal] = useState<any>(null),
    [invite, setInvite] = useState('');
  const { data: classes, error: ce } = useData('/school/classes');
  const { data: applications, error: ae } = useData('/school/applications');
  const { data: users } = useData(user.role !== 'teacher' ? '/school/users' : null);
  const { data: audit } = useData(tab === 'audit' ? '/school/audit' : null);
  const pending = applications?.filter((a) => a.status === 'pending') || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SCHOOL ADMINISTRATION</div>
          <h1>{user.role === 'teacher' ? 'Teacher workspace' : 'Administration'}</h1>
          <p>Verified members. Organized classes. Clear decisions.</p>
        </div>
        {user.role !== 'teacher' && (
          <button className="button primary" onClick={() => setModal({ type: 'class' })}>
            <Plus size={18} />
            Add class
          </button>
        )}
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat-icon gold">
            <ClipboardList />
          </span>
          <div>
            <strong>{pending.length}</strong>
            <small>Pending applications</small>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon green">
            <CheckCircle />
          </span>
          <div>
            <strong>{classes?.reduce((n, c) => n + c.approved, 0) || 0}</strong>
            <small>Approved enrolments</small>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon blue">
            <Users />
          </span>
          <div>
            <strong>{classes?.length || 0}</strong>
            <small>Classes in your scope</small>
          </div>
        </div>
      </div>
      <div className="tabs admin-tabs">
        {[
          'applications',
          'classes',
          ...(user.role !== 'teacher' ? ['users'] : []),
          ...(user.role === 'admin' ? ['staff', 'audit'] : []),
        ].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <ErrorBox error={ce || ae} />
      {tab === 'applications' && (
        <section className="card">
          <h2>Registration reviews</h2>
          <p className="muted">Class size is a reconciliation check, not proof of identity.</p>
          {!applications ? (
            <Loading />
          ) : !applications.length ? (
            <Empty title="No applications yet" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Claimed number</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                        <small>@{a.username}</small>
                      </td>
                      <td>{a.class_name}</td>
                      <td>
                        {a.claimed_number}
                        {a.duplicate && <Badge tone="gold">Duplicate claim</Badge>}
                      </td>
                      <td>
                        <Badge tone={a.status === 'approved' ? 'green' : 'gray'}>{a.status}</Badge>
                      </td>
                      <td>
                        {a.status === 'pending' && (
                          <button
                            className="button secondary"
                            onClick={() => setModal({ type: 'review', a })}
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === 'classes' && (
        <div className="class-grid">
          {classes?.map((c) => (
            <article className="card" key={c.id}>
              <div className="row">
                <span className="stat-icon blue">
                  <Users />
                </span>
                <Badge>
                  {c.year}
                  {c.archived ? ' · Archived' : ''}
                </Badge>
              </div>
              <h2>{c.name}</h2>
              <p className="muted">{c.programme}</p>
              <div className="capacity">
                <strong>
                  {c.approved}
                  <small> / {c.expected_count}</small>
                </strong>
                <span>approved students</span>
              </div>
              <progress value={c.approved} max={c.expected_count} />
              <p>
                {c.pending} pending · {Math.max(0, c.expected_count - c.approved)} places remaining
              </p>
              {c.approved + c.pending > c.expected_count && (
                <div className="notice-strip">
                  <AlertTriangle size={16} /> More applications than available places
                </div>
              )}
              {user.role !== 'teacher' && (
                <div className="actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal({ type: 'capacity', c })}
                  >
                    Adjust count
                  </button>
                  {!c.archived && (
                    <>
                      <button
                        className="button secondary"
                        onClick={() => setModal({ type: 'teacher', c })}
                      >
                        Assign teacher
                      </button>
                      <button
                        className="button ghost"
                        onClick={() => setModal({ type: 'archive', c })}
                      >
                        Archive
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === 'users' && (
        <section className="card">
          <h2>School members</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small>@{u.username}</small>
                    </td>
                    <td>{u.role}</td>
                    <td>
                      <Badge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status}</Badge>
                    </td>
                    <td>
                      <div className="actions">
                        {u.role !== 'admin' &&
                          u.id !== user.id &&
                          ['active', 'suspended'].includes(u.status) && (
                            <button
                              className="button secondary"
                              onClick={() => setModal({ type: 'status', u })}
                            >
                              {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                          )}
                        {u.role === 'student' && u.status === 'active' && (
                          <button
                            className="button ghost"
                            onClick={() => setModal({ type: 'transfer', u })}
                          >
                            Transfer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === 'staff' && (
        <section className="card narrow">
          <h2>Invite a teacher or manager</h2>
          <p>
            Send the generated single-use invitation privately to the intended staff member. It
            expires after 48 hours.
          </p>
          <ActionForm
            label="Generate invitation"
            onSubmit={async (v) => {
              const r = await post('/school/staff-invitations', {
                email: v.email,
                role: v.role,
                classIds: v.classId ? [v.classId] : [],
              });
              setInvite(r.link);
            }}
          >
            <Field name="email" type="email" label="Staff email" />
            <Field name="role" label="Role">
              <select name="role">
                <option value="teacher">Teacher</option>
                <option value="manager">School manager</option>
              </select>
            </Field>
            <Field name="classId" label="Assign class (optional)">
              <select name="classId">
                <option value="">No class assignment</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </ActionForm>
          {invite && (
            <div className="success">
              <strong>Invitation created</strong>
              <input
                readOnly
                value={invite}
                aria-label="Invitation link"
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
        </section>
      )}
      {tab === 'audit' && (
        <section className="card">
          <h2>Administrative activity</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit?.map((a) => (
                  <tr key={a.id}>
                    <td>{date(a.created_at)}</td>
                    <td>{a.action}</td>
                    <td>
                      <small>{a.target_id}</small>
                    </td>
                    <td>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {modal && (
        <Modal
          title={
            modal.type === 'review'
              ? `Review ${modal.a.name}`
              : modal.type === 'class'
                ? 'Create a class'
                : modal.type === 'capacity'
                  ? 'Reconcile class size'
                  : modal.type === 'teacher'
                    ? 'Update teacher assignment'
                    : modal.type === 'archive'
                      ? 'Archive class and end access'
                      : modal.type === 'transfer'
                        ? `Transfer ${modal.u.name}`
                        : `Update ${modal.u.name}`
          }
          onClose={() => setModal(null)}
        >
          <ActionForm
            label={modal.type === 'review' ? 'Record decision' : 'Save change'}
            onDone={() => setModal(null)}
            onSubmit={(v) => {
              if (modal.type === 'class')
                return post('/school/classes', { ...v, expectedCount: Number(v.expectedCount) });
              if (modal.type === 'review')
                return post('/school/applications/' + modal.a.id + '/decision', v);
              if (modal.type === 'capacity')
                return patch('/school/classes/' + modal.c.id, {
                  ...v,
                  expectedCount: Number(v.expectedCount),
                });
              if (modal.type === 'teacher')
                return post('/school/classes/' + modal.c.id + '/teacher', {
                  userId: v.userId,
                  remove: v.remove === 'true',
                });
              if (modal.type === 'archive')
                return post('/school/classes/' + modal.c.id + '/archive', v);
              if (modal.type === 'transfer')
                return post('/school/users/' + modal.u.id + '/transfer', v);
              return post('/school/users/' + modal.u.id + '/status', {
                ...v,
                status: modal.u.status === 'active' ? 'suspended' : 'active',
              });
            }}
          >
            {modal.type === 'class' ? (
              <>
                <Field name="name" label="Class name" placeholder="L4 SWD A" />
                <Field
                  name="programme"
                  label="Programme / trade"
                  placeholder="Software Development"
                />
                <Field name="year" label="Academic year" placeholder="2026–2027" />
                <Field name="expectedCount" label="Expected students" type="number" value={30} />
              </>
            ) : modal.type === 'review' ? (
              <>
                <p>
                  {modal.a.class_name} · {modal.a.claimed_number}
                </p>
                {modal.a.duplicate && (
                  <div className="notice-strip">Resolve the duplicate claim before approving.</div>
                )}
                <Field name="decision" label="Decision">
                  <select name="decision">
                    <option value="approve">Approve verified student</option>
                    <option value="correction">Request correction</option>
                    <option value="reject">Reject application</option>
                  </select>
                </Field>
                <Field
                  name="evidence"
                  label="Verification basis"
                  placeholder="e.g. Checked class register with teacher"
                  required={false}
                />
                <Field name="reason" label="Reason visible to applicant" />
              </>
            ) : (
              <>
                {modal.type === 'teacher' && (
                  <>
                    <Field name="userId" label="Teacher">
                      <select name="userId">
                        {users
                          ?.filter((u) => u.role === 'teacher' && u.status === 'active')
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field name="remove" label="Action">
                      <select name="remove">
                        <option value="false">Assign to class</option>
                        <option value="true">Remove assignment</option>
                      </select>
                    </Field>
                  </>
                )}
                {modal.type === 'capacity' && (
                  <Field
                    name="expectedCount"
                    label="Expected students"
                    type="number"
                    value={modal.c.expected_count}
                  />
                )}{' '}
                {modal.type === 'transfer' && (
                  <Field name="classId" label="Destination class">
                    <select name="classId">
                      {classes?.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name} ({c.approved}/{c.expected_count})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field name="reason" label="Reason for this change" />
              </>
            )}
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
