import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Home as HomeIcon,
  MessageCircle,
  Megaphone,
  Users,
  Settings as SettingsIcon,
  ShieldCheck,
  Bell,
  Menu,
  LogOut,
  X,
} from 'lucide-react';
import { api, post, setCsrf, refresh } from '../lib/api';
import { Brand, Avatar, Loading, useData, Modal, ButtonAction, date } from '../components/ui';
import { Auth, Pending } from '../features/Auth';
import { Home } from '../features/Home';
import { Chats } from '../features/Chats';
import { Announcements } from '../features/Announcements';
import { Admin } from '../features/Admin';
import { Settings, Reports } from '../features/Settings';
import '../styles/main.css';
function Shell({ user, logout }: { user: any; logout: () => void }) {
  const location = useLocation();
  const [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const { data: notices } = useData('/moderation/notifications');
  useEffect(() => {
    const socket = io({ withCredentials: true });
    socket.on('refresh', refresh);
    socket.on('connect', refresh);
    const online = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) refresh();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    return () => {
      socket.disconnect();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
    };
  }, []);
  useEffect(() => setMenu(false), [location.pathname]);
  const nav = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/chats', label: 'Chats', icon: MessageCircle },
    { path: '/announcements', label: 'Announcements', icon: Megaphone },
    ...(user.role !== 'student'
      ? [
          {
            path: '/admin',
            label: user.role === 'teacher' ? 'Teacher workspace' : 'Administration',
            icon: Users,
          },
          { path: '/reports', label: 'Moderation', icon: ShieldCheck },
        ]
      : []),
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];
  return (
    <div className="shell">
      {menu && <div className="nav-scrim" onClick={() => setMenu(false)} />}
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <Brand />
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <NavLink key={n.path} end={n.path === '/'} to={n.path}>
              <n.icon size={20} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <strong>Connected through learning</strong>
          <p>A private space for your school community.</p>
        </div>
        <Link to="/settings" className="sidebar-profile">
          <Avatar name={user.name} />
          <span>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </span>
        </Link>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>{nav.find((n) => n.path === location.pathname)?.label || 'Home'}</strong>
          </div>
          <div className="topbar-right">
            <span className="school-name">Institut Don Bosco Kabarondo</span>
            <button
              className="icon notification-button"
              title="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={21} />
              {notices?.some((n) => !n.is_read) && <i />}
            </button>
            <Avatar name={user.name} size={34} />
          </div>
        </header>
        {offline && (
          <div className="offline" role="status">
            You’re offline. Reconnect before sending. Your unsent message remains in this open
            conversation.
          </div>
        )}
        <main className={location.pathname === '/chats' ? 'page chat-page' : 'page'}>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/chats" element={<Chats user={user} />} />
            <Route path="/announcements" element={<Announcements user={user} />} />
            <Route path="/settings" element={<Settings user={user} onLogout={logout} />} />
            {user.role !== 'student' && (
              <>
                <Route path="/admin" element={<Admin user={user} />} />
                <Route path="/reports" element={<Reports />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <nav className="mobile-bottom">
          {nav
            .filter((n) => ['/', '/chats', '/announcements', '/settings'].includes(n.path))
            .map((n) => (
              <NavLink key={n.path} end={n.path === '/'} to={n.path}>
                <n.icon size={20} />
                <span>
                  {n.label === 'Announcements'
                    ? 'Notices'
                    : n.label === 'Settings'
                      ? 'Profile'
                      : n.label}
                </span>
              </NavLink>
            ))}
        </nav>
      </div>
      {notifications && (
        <Modal title="Notifications" onClose={() => setNotifications(false)}>
          <ButtonAction run={() => post('/moderation/notifications/read')}>
            Mark all as read
          </ButtonAction>
          <div className="notification-list">
            {notices?.map((n) => (
              <Link to={n.link || '/'} key={n.id} onClick={() => setNotifications(false)}>
                <strong>{n.title}</strong>
                <small>
                  {date(n.created_at)} · {n.is_read ? 'Read' : 'Unread'}
                </small>
              </Link>
            ))}
            {!notices?.length && <p>You’re all caught up.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
function App() {
  const [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true);
  const location = useLocation();
  useEffect(() => {
    api('/auth/me')
      .then((r) => {
        setUser(r.user);
        setCsrf(r.csrf);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function logout() {
    try {
      await post('/auth/logout');
    } catch {}
    setCsrf('');
    setUser(null);
    window.location.href = '/login';
  }
  if (loading) return <Loading />;
  if (['/reset', '/verify', '/invite'].includes(location.pathname))
    return <Auth onLogin={setUser} />;
  if (!user)
    return (
      <Routes>
        <Route path="/login" element={<Auth onLogin={setUser} />} />
        <Route path="/register" element={<Auth onLogin={setUser} />} />
        <Route path="/recovery" element={<Auth onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  if (user.status !== 'active') return <Pending user={user} onLogout={logout} />;
  return <Shell user={user} logout={logout} />;
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
