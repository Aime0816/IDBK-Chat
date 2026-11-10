import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Megaphone } from 'lucide-react';
import { api, post, setCsrf } from '../lib/api';
import { ActionForm, Brand, Field, useData, Badge, ButtonAction } from '../components/ui';
export function Auth({ onLogin }: { onLogin: (u: any) => void }) {
  const loc = useLocation(),
    nav = useNavigate();
  const route = loc.pathname;
  const token = new URLSearchParams(loc.search).get('token') || '';
  const { data: classes } = useData(route === '/register' ? '/auth/classes' : null);
  const [done, setDone] = useState('');
  const title =
    route === '/register'
      ? 'Join your school community'
      : route === '/recovery'
        ? 'Recover your account'
        : route === '/reset'
          ? 'Choose a new password'
          : route === '/verify'
            ? 'Verify your email'
            : route === '/invite'
              ? 'Accept your staff invitation'
              : 'Welcome back';
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div>
          <Badge tone="gold">A space for our school</Badge>
          <h1>
            Stay connected.
            <br />
            Keep learning.
            <br />
            <em>Grow together.</em>
          </h1>
          <p>Your classes, conversations, and school announcements — all in one place.</p>
          <div className="story-items">
            <span>
              <Users /> Connect with your class
            </span>
            <span>
              <Megaphone /> Never miss an announcement
            </span>
            <span>
              <ShieldCheck /> A verified school community
            </span>
          </div>
        </div>
        <small>Institut Don Bosco Kabarondo • IDBK Chat</small>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <Link to="/login" className="eyebrow">
            IDBK CHAT
          </Link>
          <h2>{title}</h2>
          <p className="muted">
            {route === '/register'
              ? 'Your application will be reviewed by authorized school staff.'
              : 'Your school community, connected.'}
          </p>
          {done ? (
            <div className="success">
              {done}
              <Link className="button primary" to="/login" onClick={() => setDone('')}>
                Back to sign in
              </Link>
            </div>
          ) : route === '/verify' ? (
            <ButtonAction
              run={() => post('/auth/verify', { token })}
              onDone={() =>
                setDone(
                  'Email verified. Your account still requires school approval if it is pending.',
                )
              }
            >
              Verify email address
            </ButtonAction>
          ) : (
            <ActionForm
              key={route}
              label={
                route === '/register'
                  ? 'Submit application'
                  : route === '/login'
                    ? 'Sign in'
                    : 'Continue'
              }
              onSubmit={async (v) => {
                if (route === '/register') {
                  await post('/auth/register', { ...v, number: v.number, classId: v.classId });
                  setDone(
                    'Application submitted. Sign in to view your approval status. If you added an email, check it for verification.',
                  );
                } else if (route === '/recovery') {
                  const r = await post('/auth/recovery', v);
                  setDone(r.message);
                } else if (route === '/reset') {
                  await post('/auth/reset', { token, password: v.password });
                  setDone('Password updated. Sign in using your new password.');
                } else if (route === '/invite') {
                  await post('/auth/invitation', { ...v, token });
                  setDone('Staff account activated. You can now sign in.');
                } else {
                  const r = await post('/auth/login', v);
                  setCsrf(r.csrf);
                  onLogin(r.user);
                  nav('/');
                }
              }}
            >
              {['/register', '/invite'].includes(route) && <Field label="Full name" name="name" />}
              {route !== '/reset' && (
                <Field label="Username" name="username" placeholder="e.g. aime.ns" />
              )}
              {route === '/register' && (
                <>
                  <Field label="School index or registration number" name="number" />
                  <Field label="Class" name="classId">
                    <select name="classId" required defaultValue="">
                      <option value="" disabled>
                        Select your class
                      </option>
                      {classes?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.year}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Recovery email (optional)"
                    name="email"
                    type="email"
                    required={false}
                  />
                  <small className="muted">
                    Use your school-record name. Your student number stays private.
                  </small>
                </>
              )}
              {route !== '/recovery' && (
                <Field
                  label={route === '/login' ? 'Password' : 'Password (at least 12 characters)'}
                  name="password"
                  type="password"
                />
              )}
            </ActionForm>
          )}
          {route === '/login' && (
            <>
              <Link to="/recovery">Forgot your password?</Link>
              <div className="auth-bottom">
                New to IDBK Chat? <Link to="/register">Apply for an account</Link>
              </div>
            </>
          )}
          {route === '/register' && (
            <p className="muted">
              Already registered? <Link to="/login">Sign in</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
export function Pending({ user, onLogout }: { user: any; onLogout: () => void }) {
  const { data: a } = useData('/auth/application');
  const { data: classes } = useData('/auth/classes');
  return (
    <div className="pending-page">
      <Brand />
      <div className="card">
        <ShieldCheck size={48} color="#078447" />
        <h1>
          {a?.status === 'correction'
            ? 'Please correct your application'
            : a?.status === 'rejected'
              ? 'Application not approved'
              : 'Your application is under review'}
        </h1>
        <p>
          Hello {user.name}. School staff must verify your identity before you can enter IDBK Chat.
        </p>
        {a && (
          <>
            <Badge>{a.status}</Badge>
            <p>
              {a.class_name} · {a.claimed_number}
            </p>
            {a.reason && <p className="notice-strip">{a.reason}</p>}
          </>
        )}
        {a?.status === 'correction' && (
          <ActionForm
            label="Resubmit application"
            onSubmit={(v) => api('/auth/application', { method: 'PATCH', body: JSON.stringify(v) })}
          >
            <Field label="Student number" name="number" value={a.claimed_number} />
            <Field label="Class" name="classId">
              <select name="classId" defaultValue={a.class_id}>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </ActionForm>
        )}
        <p className="muted">
          Refresh this page after staff approve your application. For help, contact your class
          teacher.
        </p>
        <div className="actions">
          <button className="button secondary" onClick={() => location.reload()}>
            Check status
          </button>
          <button className="button secondary" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
