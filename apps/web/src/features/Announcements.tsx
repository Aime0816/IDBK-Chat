import { useState } from 'react';
import { Megaphone, Plus, CheckCheck, FileText } from 'lucide-react';
import {
  useData,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  date,
  Modal,
  ActionForm,
  Field,
  ButtonAction,
} from '../components/ui';
import { post, put } from '../lib/api';
export function NoticeCard({ n, user, onEdit }: { n: any; user: any; onEdit?: (n: any) => void }) {
  return (
    <article className="card notice-card">
      <div className="row">
        <span className={'notice-icon ' + n.priority}>
          <Megaphone size={22} />
        </span>
        <div className="grow">
          <div className="row">
            <Badge tone={n.priority === 'important' ? 'gold' : 'green'}>
              {n.priority === 'important' ? 'Important' : 'Official notice'}
            </Badge>
            {n.status === 'draft' && <Badge>Draft</Badge>}
            {n.expired && <Badge tone="gray">Expired</Badge>}
          </div>
          <h3>{n.title}</h3>
        </div>
        <small className="muted">{date(n.created_at)}</small>
      </div>
      <p className="preserve">{n.body}</p>
      <footer>
        <div>
          <strong>{n.publisher}</strong>
          <small>
            {n.class_name || 'Entire school'} · Revision {n.revision}
          </small>
        </div>
        <div className="actions">
          {n.requires_ack &&
            n.status === 'published' &&
            (n.acknowledged ? (
              <Badge tone="green">
                <CheckCheck size={14} />
                Acknowledged
              </Badge>
            ) : n.can_ack ? (
              <ButtonAction
                run={() => post(`/announcements/${n.id}/ack`, { revision: n.revision })}
              >
                Acknowledge
              </ButtonAction>
            ) : null)}
          {onEdit && (n.publisher_id === user.id || user.role === 'admin') && (
            <button className="button ghost" onClick={() => onEdit(n)}>
              Edit
            </button>
          )}
        </div>
      </footer>
      {n.recipient_count !== undefined && (
        <small className="muted">
          {n.ack_count} of {n.recipient_count} recipients acknowledged
        </small>
      )}
    </article>
  );
}
export function Announcements({ user }: { user: any }) {
  const { data, error } = useData('/announcements');
  const { data: classes } = useData(user.role !== 'student' ? '/school/classes' : null);
  const [edit, setEdit] = useState<any>(null),
    [search, setSearch] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SCHOOL UPDATES</div>
          <h1>Announcements</h1>
          <p>Official information, easy to find.</p>
        </div>
        {user.role !== 'student' && (
          <button className="button primary" onClick={() => setEdit({})}>
            <Plus size={18} />
            New announcement
          </button>
        )}
      </div>
      <input
        className="search standalone"
        aria-label="Search announcements"
        placeholder="Search announcements…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ErrorBox error={error} />
      {!data ? (
        <Loading />
      ) : !data.length ? (
        <Empty
          title="No announcements yet"
          text="Official school and class updates will appear here."
        />
      ) : (
        <div className="notice-grid">
          {data
            .filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
            .map((n) => (
              <NoticeCard key={n.id} n={n} user={user} onEdit={setEdit} />
            ))}
        </div>
      )}
      {edit && (
        <Modal
          title={edit.id ? 'Edit announcement' : 'New announcement'}
          onClose={() => setEdit(null)}
        >
          <ActionForm
            label="Save announcement"
            onDone={() => setEdit(null)}
            onSubmit={(v) => {
              const d = {
                ...v,
                classId: v.classId || null,
                requiresAck: v.requiresAck === 'on',
                expiresAt: v.expiresAt ? new Date(v.expiresAt).getTime() : null,
              };
              return edit.id ? put('/announcements/' + edit.id, d) : post('/announcements', d);
            }}
          >
            <Field name="title" label="Title" value={edit.title} />
            <Field name="body" label="Message">
              <textarea name="body" rows={5} required defaultValue={edit.body} />
            </Field>
            <Field name="classId" label="Audience">
              <select
                name="classId"
                defaultValue={edit.class_id || ''}
                required={user.role === 'teacher'}
              >
                {user.role !== 'teacher' && <option value="">Entire school</option>}
                {classes
                  ?.filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="two-col">
              <Field name="priority" label="Priority">
                <select name="priority" defaultValue={edit.priority || 'normal'}>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                </select>
              </Field>
              <Field name="status" label="Publish state">
                <select name="status" defaultValue={edit.status || 'draft'}>
                  {edit.status !== 'published' && <option value="draft">Save draft</option>}
                  <option value="published">Publish to audience</option>
                </select>
              </Field>
            </div>
            <Field
              name="expiresAt"
              label="Expiry date (optional)"
              type="date"
              required={false}
              value={
                edit.expires_at ? new Date(Number(edit.expires_at)).toISOString().slice(0, 10) : ''
              }
            />
            <label className="check">
              <input type="checkbox" name="requiresAck" defaultChecked={!!edit.requires_ack} />
              Request acknowledgement
            </label>
            <p className="muted">
              Review the audience before publishing. Editing a published notice creates a new
              revision.
            </p>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
