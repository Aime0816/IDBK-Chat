import React, { useEffect, useState } from 'react';
import { X, LoaderCircle, MessageCircle, ArrowRight } from 'lucide-react';
import { api, refresh } from '../lib/api';
export function useData(path: string | null) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (path)
        api(path)
          .then((d) => {
            if (mounted) {
              setData(d);
              setError('');
            }
          })
          .catch((e) => mounted && setError(e.message));
    };
    setData(null);
    load();
    window.addEventListener('idbk-refresh', load);
    const t = setInterval(load, 15000);
    return () => {
      mounted = false;
      window.removeEventListener('idbk-refresh', load);
      clearInterval(t);
    };
  }, [path]);
  return { data, error };
}
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: ['#078447', '#2563eb', '#8257d5', '#e49300'][name.charCodeAt(0) % 4],
      }}
    >
      {initials}
    </span>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <MessageCircle size={25} />
      </span>
      <span>
        IDBK Chat<small>Institut Don Bosco Kabarondo</small>
      </span>
    </div>
  );
}
export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty">
      <MessageCircle size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" /> Loading…
    </div>
  );
}
export function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function time(value: any) {
  return new Date(Number(value)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
export function date(value: any) {
  return new Date(Number(value)).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', f);
    const previous = document.activeElement as HTMLElement;
    setTimeout(() => document.querySelector<HTMLButtonElement>('.modal button')?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', f);
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const f = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]'),
            ).filter((x) => !x.hasAttribute('disabled'));
            const first = f[0],
              last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ActionForm({
  children,
  onSubmit,
  label = 'Save',
  onDone,
}: {
  children: React.ReactNode;
  onSubmit: (data: any) => Promise<any>;
  label?: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        setBusy(true);
        setError('');
        try {
          await onSubmit(values);
          refresh();
          onDone?.();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-fields">{children}</div>
      <ErrorBox error={error} />
      <button className="button primary" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={18} /> : null}
        {label}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
export function Field({
  label,
  name,
  type = 'text',
  required = true,
  placeholder = '',
  value,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={value}
        />
      )}
    </label>
  );
}
export function ButtonAction({
  children,
  run,
  className = 'button secondary',
  onDone,
}: {
  children: React.ReactNode;
  run: () => Promise<any>;
  className?: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await run();
            refresh();
            onDone?.();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Please wait…' : children}
      </button>
      {error && (
        <small className="error-inline" role="alert">
          {error}
        </small>
      )}
    </>
  );
}
