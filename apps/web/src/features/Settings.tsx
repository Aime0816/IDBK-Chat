import { useState } from 'react';
import { useData, ActionForm, Field, ButtonAction, Badge, Modal, Empty } from '../components/ui';
import { api, post } from '../lib/api';
export function Settings({ user, onLogout }: { user: any; onLogout: () => void }) {
  const { data: blocks } = useData('/moderation/blocks');
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">YOUR ACCOUNT</div>
        <h1>Profile & settings</h1>
        <p>Manage your security and communication preferences.</p>
      </div>
      <div className="settings-grid">
        <section className="card">
          <h2>{user.name}</h2>
          <p>@{user.username}</p>
          <Badge tone="green">
            {user.role} · {user.status}
          </Badge>
          <p>{user.email || 'No recovery email on this account'}</p>
          {user.email && !user.email_verified && (
            <ButtonAction run={() => post('/auth/verify/resend')}>
              Resend email verification
            </ButtonAction>
          )}
          {user.email_verified && <Badge>Email verified</Badge>}
          <p className="muted">
            For profile corrections or recovery without verified email, contact school staff. Sign
            out when using a shared computer.
          </p>
          <ButtonAction run={async () => onLogout()}>Sign out</ButtonAction>
        </section>
        <section className="card">
          <h2>Change password</h2>
          <ActionForm
            label="Update password and sign out"
            onSubmit={(v) => post('/auth/password', v)}
            onDone={onLogout}
          >
            <Field label="Current password" name="current" type="password" />
            <Field label="New password (12+ characters)" name="password" type="password" />
          </ActionForm>
        </section>
        <section className="card">
          <h2>Blocked members</h2>
          <p className="muted">
            Blocking prevents direct messages and invitations. Official class discussions remain
            visible.
          </p>
          {blocks?.length ? (
            blocks.map((b) => (
              <div className="row member-item" key={b.id}>
                <span className="grow">{b.name}</span>
                <ButtonAction run={() => api('/moderation/blocks/' + b.id, { method: 'DELETE' })}>
                  Unblock
                </ButtonAction>
              </div>
            ))
          ) : (
            <p>No blocked members.</p>
          )}
        </section>
      </div>
    </>
  );
}
export function Reports() {
  const { data } = useData('/moderation/reports');
  const [selected, setSelected] = useState<any>(null);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">COMMUNITY SAFETY</div>
        <h1>Moderation reports</h1>
        <p>Review reported evidence within your assigned scope.</p>
      </div>
      {data?.length ? (
        <div className="notice-grid">
          {data.map((r) => (
            <article className="card" key={r.id}>
              <div className="row">
                <Badge tone={r.status === 'open' ? 'gold' : 'green'}>{r.status}</Badge>
              </div>
              <h3>{r.reason}</h3>
              <p>{r.evidence.length} messages of reported context</p>
              {r.resolution && <p className="muted">Resolution: {r.resolution}</p>}
              <button className="button secondary" onClick={() => setSelected(r)}>
                Review evidence
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No reports to review" />
      )}
      {selected && (
        <Modal title="Reported message context" onClose={() => setSelected(null)}>
          <div className="evidence">
            {selected.evidence.map((m) => (
              <div key={m.id}>
                <strong>{m.name}</strong>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
          {selected.status === 'open' && (
            <ActionForm
              label="Resolve report"
              onSubmit={(v) => post('/moderation/reports/' + selected.id + '/resolve', v)}
              onDone={() => setSelected(null)}
            >
              <Field label="Action" name="action">
                <select name="action">
                  <option value="dismiss">Resolve without hiding</option>
                  <option value="hide">Hide reported message</option>
                </select>
              </Field>
              <Field name="reason" label="Resolution reason" />
            </ActionForm>
          )}
        </Modal>
      )}
    </>
  );
}
