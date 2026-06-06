'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Trash2 } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import { isStudentOnly } from '@/lib/role-helpers';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Hostel = 'NONE' | 'H1' | 'H2' | 'H3';

interface Pass {
  id: string;
  fullName: string;
  groupOrPosition: string;
  hostel: Hostel;
  ticketKey: string | null;
  maxUserId: string | null;
  status: Status;
  statusComment: string | null;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<Status, string> = { PENDING: 'В работе', APPROVED: 'Выдан', REJECTED: 'Отклонён' };
const STATUS_VARIANT: Record<Status, string> = { PENDING: 'badge--warn', APPROVED: 'badge--ok', REJECTED: 'badge--bad' };
const HOSTEL_LABELS: Record<Hostel, string> = { NONE: 'Нет', H1: 'Общежитие 1', H2: 'Общежитие 2', H3: 'Общежитие 3' };

export default function PassDetailPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA', 'STU']}>
      <PassDetail />
    </Protected>
  );
}

function PassDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const studentMode = isStudentOnly(user);
  const id = params?.id;
  const [pass, setPass] = useState<Pass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const p = await apiFetch<Pass>(`/api/passes/${id}`);
      setPass(p);
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function decide(decision: 'APPROVE' | 'REJECT' | 'RESET') {
    if (!pass) return;
    let body: Record<string, unknown> = { decision };
    if (decision === 'REJECT') {
      const reason = window.prompt('Причина отказа:')?.trim();
      if (!reason) return;
      body = { decision, comment: reason };
    } else if (decision === 'APPROVE') {
      const note = window.prompt('Комментарий (необязательно):')?.trim();
      if (note) body = { decision, approveComment: note };
    }
    setBusy(true);
    try {
      await apiFetch(`/api/passes/${pass.id}/status`, { method: 'POST', body });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function viewTicket() {
    if (!pass) return;
    try {
      const r = await apiFetch<{ url: string | null }>(`/api/passes/${pass.id}/ticket-url`);
      if (r.url) window.open(r.url, '_blank', 'noopener');
      else alert('Квитанция не загружена');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    }
  }

  async function replaceTicket(file: File) {
    if (!pass) return;
    setTicketBusy(true);
    try {
      // Бэк сам решит: если пользователь — сотрудник, статус не проверяется;
      // студент сможет грузить только в свою заявку и только в PENDING.
      const init = await apiFetch<{ uploadUrl: string }>(`/api/passes/${pass.id}/ticket-upload`, {
        method: 'POST',
        body: {
          originalName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });
      const put = await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('Не удалось загрузить файл в хранилище');
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setTicketBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteTicket() {
    if (!pass) return;
    if (!window.confirm('Удалить квитанцию?')) return;
    setTicketBusy(true);
    try {
      await apiFetch(`/api/passes/${pass.id}/ticket`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setTicketBusy(false);
    }
  }

  if (error) return <div className="callout callout--danger"><span>{error}</span></div>;
  if (!pass) return <div className="muted">Загрузка…</div>;

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 720 }}>
      <button onClick={() => router.back()} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> Назад
      </button>

      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          пропуск · #{pass.id.slice(0, 8)}
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', margin: 0, lineHeight: 1.1 }}>
          {pass.fullName}
        </h1>
        <div><span className={`badge ${STATUS_VARIANT[pass.status]}`}>{STATUS_LABELS[pass.status]}</span></div>
      </header>

      <div className="card col" style={{ padding: 'var(--s-5)', gap: 'var(--s-3)' }}>
        <Field label="Группа / должность" value={pass.groupOrPosition} mono />
        <Field label="Общежитие" value={HOSTEL_LABELS[pass.hostel]} />
        <Field label="ID в Max" value={pass.maxUserId ?? '—'} mono />
        <Field label="Комментарий статуса" value={pass.statusComment ?? '—'} />
        <Field label="Создано" value={fmt(pass.createdAt)} />
        <Field label="Обновлено" value={fmt(pass.updatedAt)} />
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Квитанция</span>
          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            {pass.ticketKey ? (
              <>
                <button className="btn btn--ghost btn--sm" onClick={viewTicket} disabled={ticketBusy}>
                  Открыть
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => fileInputRef.current?.click()} disabled={ticketBusy}>
                  <Upload size={12} strokeWidth={1.75} /> Заменить
                </button>
                <button className="btn btn--danger btn--sm" onClick={deleteTicket} disabled={ticketBusy}>
                  <Trash2 size={12} strokeWidth={1.75} /> Удалить
                </button>
              </>
            ) : (
              <>
                <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>не приложена</span>
                <button className="btn btn--ghost btn--sm" onClick={() => fileInputRef.current?.click()} disabled={ticketBusy}>
                  <Upload size={12} strokeWidth={1.75} /> Загрузить
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void replaceTicket(f);
              }}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        {!studentMode && pass.status !== 'APPROVED' && (
          <button onClick={() => decide('APPROVE')} disabled={busy} className="btn btn--primary">Выдать</button>
        )}
        {!studentMode && pass.status !== 'REJECTED' && (
          <button onClick={() => decide('REJECT')} disabled={busy} className="btn btn--danger">Отклонить</button>
        )}
        {!studentMode && pass.status !== 'PENDING' && (
          <button onClick={() => decide('RESET')} disabled={busy} className="btn btn--ghost">Вернуть в работу</button>
        )}
        <Link href="/passes" className="btn btn--ghost" style={{ marginLeft: 'auto' }}>К списку</Link>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ fontSize: 'var(--fs-14)' }}>{value}</span>
    </div>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU');
}
