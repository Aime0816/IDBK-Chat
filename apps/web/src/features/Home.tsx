import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageCircle, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { useData, Avatar, Badge, Loading, ErrorBox, date } from '../components/ui';
export function Home({ user }: { user: any }) {
  const { data: notices, error } = useData('/announcements'),
    { data: chats } = useData('/conversations');
  const current = notices?.filter((n) => n.status === 'published' && !n.expired) || [];
  return (
    <>
      <div className="welcome">
        <div>
          <Badge tone="gold">YOUR SCHOOL COMMUNITY</Badge>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p>Good to see you. Catch up, share ideas, and keep learning.</p>
          <Link className="button white" to="/chats">
            Open your conversations
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="welcome-art">
          <div>
            <MessageCircle size={58} />
          </div>
          <span>
            <Users size={28} />
          </span>
          <small>
            <ShieldCheck size={25} />
          </small>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat-icon blue">
            <MessageCircle />
          </span>
          <div>
            <strong>{chats?.reduce((s, c) => s + c.unread, 0) || 0}</strong>
            <small>Unread messages</small>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon gold">
            <Megaphone />
          </span>
          <div>
            <strong>{current.length}</strong>
            <small>Current announcements</small>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon green">
            <Users />
          </span>
          <div>
            <strong>{chats?.filter((c) => c.type === 'class').length || 0}</strong>
            <small>Your classes</small>
          </div>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="home-columns">
        <section>
          <div className="section-heading">
            <h2>School announcements</h2>
            <Link to="/announcements">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          {!notices ? (
            <Loading />
          ) : (
            current.slice(0, 3).map((n) => (
              <Link key={n.id} to="/announcements" className="card home-notice">
                <div className="row">
                  <span className="notice-icon">
                    <Megaphone />
                  </span>
                  <Badge tone={n.priority === 'important' ? 'gold' : 'green'}>
                    {n.priority === 'important' ? 'Important' : 'Official'}
                  </Badge>
                  <small className="muted push">{date(n.created_at)}</small>
                </div>
                <h3>{n.title}</h3>
                <p>
                  {n.body.slice(0, 140)}
                  {n.body.length > 140 ? '…' : ''}
                </p>
                <small>
                  {n.publisher} · {n.class_name || 'Entire school'}
                </small>
              </Link>
            ))
          )}
          {notices && !current.length && (
            <div className="card">
              <p>No current announcements. You’re all caught up.</p>
            </div>
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>Recent conversations</h2>
            <Link to="/chats">View all</Link>
          </div>
          <div className="card recent-list">
            {chats?.slice(0, 5).map((c) => (
              <Link key={c.id} to={'/chats?conversation=' + c.id}>
                <Avatar name={c.title} />
                <div className="grow">
                  <strong>{c.title}</strong>
                  <small>
                    {c.last?.deleted_at
                      ? 'Message removed'
                      : c.last?.body?.slice(0, 45) || 'Start the conversation'}
                  </small>
                </div>
                {c.unread > 0 && <Badge tone="gold">{c.unread}</Badge>}
              </Link>
            ))}
            {!chats?.length && <p className="muted">Your conversations will appear here.</p>}
          </div>
          <div className="community-note">
            <ShieldCheck />
            <h3>A space built on respect</h3>
            <p>
              Keep conversations kind. Use the report option when you need help from school staff.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
