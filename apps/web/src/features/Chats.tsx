import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Send,
  Paperclip,
  ArrowLeft,
  MoreHorizontal,
  ShieldCheck,
  Reply,
  FileText,
  X,
  Users,
  Megaphone,
} from 'lucide-react';
import { api, post, patch, refresh } from '../lib/api';
import {
  useData,
  Avatar,
  Badge,
  Modal,
  ActionForm,
  Field,
  Empty,
  ErrorBox,
  ButtonAction,
  time,
} from '../components/ui';
export function Chats({ user }: { user: any }) {
  const { data: chats, error } = useData('/conversations'),
    { data: invites } = useData('/conversations/invitations');
  const [params, setParams] = useSearchParams();
  const selected = params.get('conversation');
  const [search, setSearch] = useState(''),
    [tab, setTab] = useState('all'),
    [modal, setModal] = useState(''),
    [directory, setDirectory] = useState<any[]>([]),
    [query, setQuery] = useState(''),
    [actionError, setActionError] = useState('');
  const conversation = chats?.find((c) => c.id === selected);
  useEffect(() => {
    if (query.length < 2) {
      setDirectory([]);
      return;
    }
    let active = true;
    const timer = setTimeout(
      () =>
        api('/conversations/directory?q=' + encodeURIComponent(query))
          .then((r) => active && setDirectory(r))
          .catch((e) => active && setActionError(e.message)),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className={'chat-workspace ' + (selected ? 'has-selection' : '')}>
      <aside className="chat-list">
        <header>
          <h1>Chats</h1>
          <button
            className="icon primary"
            title="New conversation"
            onClick={() => {
              setModal('new');
              setActionError('');
            }}
          >
            <Plus size={20} />
          </button>
        </header>
        <div className="search-wrap">
          <Search size={17} />
          <input
            aria-label="Search conversations"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs">
          {['all', 'class', 'direct', 'group'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'all'
                ? 'All'
                : t === 'class'
                  ? 'Classes'
                  : t === 'direct'
                    ? 'Direct'
                    : 'Groups'}
            </button>
          ))}
        </div>
        {invites?.length > 0 && (
          <button className="invitation-banner" onClick={() => setModal('requests')}>
            {invites.length} invitation{invites.length > 1 ? 's' : ''} waiting{' '}
            <ArrowLeft size={14} />
          </button>
        )}
        <ErrorBox error={error} />
        <div className="conversation-rows">
          {chats
            ?.filter(
              (c) =>
                (tab === 'all' || c.type === tab) &&
                c.title.toLowerCase().includes(search.toLowerCase()),
            )
            .map((c) => (
              <button
                key={c.id}
                className={'conversation-row ' + (c.id === selected ? 'selected' : '')}
                onClick={() => setParams({ conversation: c.id })}
              >
                <Avatar name={c.title} />
                <span className="grow">
                  <strong>{c.title}</strong>
                  <small>
                    {c.last?.deleted_at
                      ? 'Message removed'
                      : c.last?.body ||
                        (c.type === 'class' ? 'Official class' : 'Start a conversation')}
                  </small>
                </span>
                <span className="conversation-meta">
                  <small>{c.last ? time(c.last.created_at) : ''}</small>
                  {c.unread > 0 && <Badge tone="gold">{c.unread}</Badge>}
                </span>
              </button>
            ))}
        </div>
        <footer>
          <ShieldCheck size={15} /> Your verified school community
        </footer>
      </aside>
      {conversation ? (
        <Conversation
          key={conversation.id}
          user={user}
          c={conversation}
          back={() => setParams({})}
          manage={() => setModal('manage')}
        />
      ) : (
        <div className="chat-placeholder">
          <div className="chat-placeholder-icon">
            <Users size={56} />
          </div>
          <h2>Your conversations start here</h2>
          <p>
            Choose your class, reach out to a teacher,
            <br />
            or create a study group with friends.
          </p>
          <button className="button primary" onClick={() => setModal('new')}>
            <Plus size={18} />
            Start a conversation
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === 'new'
              ? 'Start a conversation'
              : modal === 'requests'
                ? 'Your invitations'
                : 'Conversation members'
          }
          onClose={() => {
            setModal('');
            setQuery('');
          }}
        >
          <ErrorBox error={actionError} />
          {modal === 'requests' ? (
            invites?.map((i) => (
              <div className="request-card" key={i.id}>
                <strong>{i.title}</strong>
                <p>{i.sender} invited you. You will see messages sent after joining.</p>
                <div className="actions">
                  <ButtonAction
                    run={() => post(`/conversations/invitations/${i.id}`, { accept: true })}
                  >
                    Accept
                  </ButtonAction>
                  <ButtonAction
                    run={() => post(`/conversations/invitations/${i.id}`, { accept: false })}
                  >
                    Decline
                  </ButtonAction>
                </div>
              </div>
            ))
          ) : (
            <>
              {modal === 'new' && (
                <ActionForm
                  label="Create private group"
                  onSubmit={(v) => post('/conversations', v)}
                  onDone={() => setModal('')}
                >
                  <Field
                    label="New study group name"
                    name="title"
                    placeholder="e.g. Coding study group"
                  />
                </ActionForm>
              )}
              {modal === 'manage' && (
                <>
                  <div className="member-list">
                    {conversation?.members.map((m) => (
                      <div key={m.id} className="row">
                        <Avatar name={m.name} size={34} />
                        <span className="grow">
                          {m.name}
                          <small className="muted">
                            {m.role}
                            {m.id === conversation.owner_id ? ' · Owner' : ''}
                          </small>
                        </span>
                        {conversation.type === 'group' &&
                          conversation.owner_id === user.id &&
                          m.id !== user.id && (
                            <ButtonAction
                              run={() =>
                                post(`/conversations/${conversation.id}/remove`, { userId: m.id })
                              }
                            >
                              Remove
                            </ButtonAction>
                          )}
                      </div>
                    ))}
                  </div>
                  {conversation?.type === 'direct' && (
                    <ButtonAction
                      run={() =>
                        post(
                          '/moderation/blocks/' +
                            conversation.members.find((m) => m.id !== user.id)?.id,
                        )
                      }
                    >
                      Block direct contact
                    </ButtonAction>
                  )}
                  {conversation?.type === 'group' && (
                    <ActionForm
                      label="Leave group"
                      onSubmit={(v) => post(`/conversations/${conversation.id}/leave`, v)}
                      onDone={() => {
                        setModal('');
                        setParams({});
                      }}
                    >
                      {conversation.owner_id === user.id && conversation.members.length > 1 ? (
                        <Field name="successorId" label="Transfer ownership before leaving">
                          <select name="successorId">
                            {conversation.members
                              .filter((m) => m.id !== user.id)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                      ) : (
                        <p className="muted">Leaving removes access to this group's history.</p>
                      )}
                    </ActionForm>
                  )}
                </>
              )}
              {(modal === 'new' ||
                (conversation?.type === 'group' && conversation.owner_id === user.id)) && (
                <>
                  <h3>{modal === 'new' ? 'Or find a school member' : 'Invite a school member'}</h3>
                  <input
                    className="search"
                    placeholder="Search by name…"
                    aria-label="Find member"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="member-list">
                    {directory.map((u) => (
                      <div className="row" key={u.id}>
                        <Avatar name={u.name} size={34} />
                        <span className="grow">
                          <strong>{u.name}</strong>
                          <small>{u.role}</small>
                        </span>
                        <ButtonAction
                          run={async () => {
                            if (modal === 'new') {
                              const r = await post('/conversations/direct', { userId: u.id });
                              setParams({ conversation: r.id });
                              setModal('');
                            } else {
                              await post(`/conversations/${conversation.id}/invite`, {
                                userId: u.id,
                              });
                              setModal('');
                            }
                          }}
                        >
                          {modal === 'new' ? 'Message' : 'Invite'}
                        </ButtonAction>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Conversation({
  user,
  c,
  back,
  manage,
}: {
  user: any;
  c: any;
  back: () => void;
  manage: () => void;
}) {
  const { data, error } = useData('/messages/' + c.id);
  const [older, setOlder] = useState<any[]>([]),
    [body, setBody] = useState(''),
    [files, setFiles] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(''),
    [reply, setReply] = useState<any>(null),
    [edit, setEdit] = useState<any>(null),
    [report, setReport] = useState<any>(null),
    [failed, setFailed] = useState<any>(null),
    [menu, setMenu] = useState(''),
    [hasOlder, setHasOlder] = useState(true);
  const end = useRef<HTMLDivElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const { data: notices } = useData('/announcements');
  const notice = notices?.find(
    (n) => n.status === 'published' && !n.expired && (!n.class_id || n.class_id === c.class_id),
  );
  const all = [
    ...new Map([...older, ...(data?.messages || [])].map((m) => [m.id, m])).values(),
  ].sort((a: any, b: any) => a.sequence - b.sequence) as any[];
  const last = data?.messages?.at(-1)?.sequence;
  useEffect(() => {
    if (last) {
      post('/conversations/' + c.id + '/read', { sequence: last }).catch(() => {});
      end.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [last]);
  async function send(payload?: any) {
    const v = payload || {
      clientId: crypto.randomUUID(),
      body,
      replyTo: reply?.id || null,
      attachmentIds: files.map((f) => f.id),
    };
    if (!v.body.trim() && !v.attachmentIds.length) return;
    setBusy(true);
    setErr('');
    try {
      await post('/messages/' + c.id, v);
      setBody('');
      setFiles([]);
      setReply(null);
      setFailed(null);
      refresh();
    } catch (e: any) {
      setErr(e.message);
      setFailed(v);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="conversation">
      <header className="conversation-header">
        <button className="icon back-mobile" aria-label="Back to chats" onClick={back}>
          <ArrowLeft />
        </button>
        <Avatar name={c.title} size={46} />
        <div className="grow">
          <div className="row">
            <h2>{c.title}</h2>
            {c.type === 'class' && (
              <Badge tone="green">
                <ShieldCheck size={12} />
                Official class
              </Badge>
            )}
          </div>
          <small>
            {c.members.length} member{c.members.length === 1 ? '' : 's'}
            {c.type === 'direct' && c.members.length < 2 ? ' · Waiting for acceptance' : ''}
          </small>
        </div>
        <button className="icon" title="Members and options" onClick={manage}>
          <MoreHorizontal />
        </button>
      </header>
      {notice && (
        <a className="pinned-notice" href="/announcements">
          <Megaphone size={24} />
          <div>
            <strong>{notice.title}</strong>
            <small>{notice.publisher} · View announcement</small>
          </div>
          <ArrowLeft className="rotate" size={18} />
        </a>
      )}
      <div className="messages">
        <div className="day-separator">Your conversation</div>
        {data?.hasMore && hasOlder && (
          <button
            className="button ghost"
            onClick={async () => {
              try {
                const r = await api(`/messages/${c.id}?before=${all[0].sequence}`);
                setOlder([...r.messages, ...older]);
                setHasOlder(r.hasMore);
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            Load earlier messages
          </button>
        )}
        <ErrorBox error={error} />
        {data && !all.length && (
          <Empty title="Say hello" text="This is the beginning of your conversation." />
        )}
        {all.map((m) => (
          <div key={m.id} className={'message ' + (m.sender_id === user.id ? 'own' : '')}>
            <Avatar name={m.sender_name} size={32} />
            <div className="message-content">
              <div className="message-author">
                {m.sender_id === user.id ? 'You' : m.sender_name}
                {m.sender_role === 'teacher' && <span>Teacher</span>}
              </div>
              <div className={'bubble ' + (m.deleted_at ? 'deleted' : '')}>
                {m.reply_to && <blockquote>{m.reply_preview}</blockquote>}
                <div className="preserve">{m.body}</div>
                {m.attachments?.map((a) => (
                  <a
                    className="file-card"
                    key={a.id}
                    href={'/api/v1/attachments/' + a.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={28} />
                    <span>
                      <strong>{a.name}</strong>
                      <small>{Math.ceil(a.size / 1024)} KB · Download</small>
                    </span>
                  </a>
                ))}
              </div>
              <div className="message-meta">
                {time(m.created_at)}
                {m.edited_at ? ' · Edited' : ''}
                {!m.deleted_at && (
                  <button
                    className="icon tiny"
                    aria-label="Message options"
                    onClick={() => setMenu(menu === m.id ? '' : m.id)}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                )}
              </div>
              {menu === m.id && (
                <div className="message-actions">
                  <button
                    onClick={() => {
                      setReply(m);
                      setMenu('');
                    }}
                  >
                    Reply
                  </button>
                  {m.sender_id === user.id && Date.now() - Number(m.created_at) < 900000 && (
                    <>
                      <button
                        onClick={() => {
                          setEdit(m);
                          setMenu('');
                        }}
                      >
                        Edit
                      </button>
                      <ButtonAction
                        className="text-button"
                        run={() => api('/messages/item/' + m.id, { method: 'DELETE' })}
                        onDone={() => setMenu('')}
                      >
                        Remove
                      </ButtonAction>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setReport(m);
                      setMenu('');
                    }}
                  >
                    Report
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="composer-wrap">
        <ErrorBox error={err} />
        {failed && <ButtonAction run={() => send(failed)}>Retry unsent message</ButtonAction>}
        {reply && (
          <div className="reply-strip">
            <Reply size={15} />
            <span>
              Replying to {reply.sender_name}: {reply.body.slice(0, 70)}
            </span>
            <button className="icon tiny" onClick={() => setReply(null)} aria-label="Cancel reply">
              <X size={15} />
            </button>
          </div>
        )}
        {files.map((f) => (
          <div className="reply-strip" key={f.id}>
            <FileText size={15} />
            {f.name}
            <button
              className="icon tiny"
              onClick={() => setFiles(files.filter((x) => x.id !== f.id))}
              aria-label="Remove attachment"
            >
              <X size={15} />
            </button>
          </div>
        ))}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            hidden
            ref={upload}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (files.length >= 3) {
                setErr('Maximum three attachments');
                return;
              }
              const fd = new FormData();
              fd.append('file', file);
              setBusy(true);
              try {
                setFiles([...files, await api('/attachments', { method: 'POST', body: fd })]);
                setErr('');
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setBusy(false);
                if (upload.current) upload.current.value = '';
              }
            }}
          />
          <button
            type="button"
            className="icon"
            title="Attach PNG, JPEG or PDF"
            disabled={busy}
            onClick={() => upload.current?.click()}
          >
            <Paperclip />
          </button>
          <textarea
            aria-label="Message"
            placeholder={c.type === 'class' ? 'Message your class…' : 'Write a message…'}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setFailed(null);
            }}
            maxLength={4000}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!busy) send();
              }
            }}
          />
          <button
            className="send"
            disabled={busy || (!body.trim() && !files.length)}
            aria-label="Send message"
          >
            <Send size={22} />
          </button>
        </form>
        <small className="composer-hint">Enter to send · Shift + Enter for a new line</small>
      </div>
      {edit && (
        <Modal title="Edit message" onClose={() => setEdit(null)}>
          <ActionForm
            label="Save changes"
            onSubmit={(v) => patch('/messages/item/' + edit.id, v)}
            onDone={() => setEdit(null)}
          >
            <Field label="Message" name="body">
              <textarea name="body" defaultValue={edit.body} rows={4} required />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {report && (
        <Modal title="Report this message" onClose={() => setReport(null)}>
          <p>School moderators will see this message and up to two messages before and after it.</p>
          <ActionForm
            label="Submit report"
            onSubmit={(v) => post('/moderation/reports', { messageId: report.id, ...v })}
            onDone={() => setReport(null)}
          >
            <Field name="reason" label="What happened?">
              <textarea name="reason" minLength={5} required rows={4} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </section>
  );
}
