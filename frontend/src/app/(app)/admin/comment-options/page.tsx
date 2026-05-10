'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessagesSquare, Plus, Trash2, X } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

interface CommentOption {
  id: string;
  title: string;
  text: string;
  isDefault: boolean;
}

export default function CommentOptionsPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM']}>
      <CommentOptionsView />
    </Protected>
  );
}

function CommentOptionsView() {
  const [items, setItems] = useState<CommentOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await apiFetch<CommentOption[]>('/api/comment-options'));
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!window.confirm('Удалить вариант комментария?')) return;
    setBusy(id);
    try {
      await apiFetch(`/api/comment-options/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 880 }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            администрация · справочники
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', margin: 0, lineHeight: 1.1 }}>
            Шаблоны комментариев
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)', maxWidth: 600 }}>
            Готовые формулировки для статусов пропусков и справок. Один из них можно отметить как «по умолчанию» —
            он будет подставляться в поле комментария при отказе/выдаче.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
          <Plus size={14} strokeWidth={2} /> Добавить
        </button>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {!items ? (
        <div className="muted">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
          <MessagesSquare size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>Шаблонов пока нет</span>
        </div>
      ) : (
        <div className="card card--bleed">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Текст</th>
                <th style={{ width: 120 }}>По умолчанию</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td className="muted" style={{ fontSize: 'var(--fs-13)' }}>{c.text}</td>
                  <td>{c.isDefault ? <span className="badge badge--ok">да</span> : ''}</td>
                  <td>
                    <button onClick={() => remove(c.id)} disabled={busy === c.id} className="btn btn--ghost btn--icon btn--sm" title="Удалить">
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <NewCommentModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); void load(); }} />}
    </div>
  );
}

function NewCommentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/comment-options', {
        method: 'POST',
        body: { title: title.trim(), text: text.trim(), isDefault },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-4)',
    }}>
      <form className="card col" onClick={(e) => e.stopPropagation()} onSubmit={submit}
            style={{ maxWidth: 480, width: '100%', padding: 'var(--s-5)', gap: 'var(--s-4)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Новый шаблон</h2>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="callout callout--danger"><span>{error}</span></div>}

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Название (для админки)</span>
          <input className="input" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Нет квитанции" />
        </label>
        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Текст комментария</span>
          <textarea className="input" required maxLength={255} rows={3} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="Не приложена квитанция об оплате — приложите файл и подайте заявку повторно." />
        </label>
        <label className="row" style={{ gap: 'var(--s-2)', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <span style={{ fontSize: 'var(--fs-13)' }}>Сделать по умолчанию (сбросит флаг у остальных)</span>
        </label>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
