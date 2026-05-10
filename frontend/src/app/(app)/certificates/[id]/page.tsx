'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Pencil, RotateCcw, Check, X } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type CertType = 'STUDY' | 'SCHOLARSHIP' | 'INCOME' | 'TAX' | 'MILITARY';

interface Cert {
  id: string;
  displayNo: number;
  certType: CertType;
  fullName: string;
  fullNameDat: string | null;
  birthDate: string;
  groupName: string;
  targetOrg: string;
  phone: string;
  email: string;
  comment: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  status: Status;
  statusComment: string | null;
  reviewerId: string | null;
  maxUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<Status, string> = { PENDING: 'В работе', APPROVED: 'Выполнена', REJECTED: 'Отклонена' };
const STATUS_VARIANT: Record<Status, string> = { PENDING: 'badge--warn', APPROVED: 'badge--ok', REJECTED: 'badge--bad' };
const TYPE_LABELS: Record<CertType, string> = {
  STUDY: 'Об обучении', SCHOLARSHIP: 'О стипендии',
  INCOME: 'О доходах', TAX: 'Налоговый вычет', MILITARY: 'В военкомат',
};

export default function CertificateDetailPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA', 'STU']}>
      <CertificateDetail />
    </Protected>
  );
}

function CertificateDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [cert, setCert] = useState<Cert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingDative, setEditingDative] = useState(false);
  const [dativeDraft, setDativeDraft] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setCert(await apiFetch<Cert>(`/api/certificates/${id}`));
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function decide(decision: 'APPROVE' | 'REJECT' | 'RESET') {
    if (!cert) return;
    let body: Record<string, unknown> = { decision };
    if (decision === 'REJECT') {
      const reason = window.prompt('Причина отклонения:')?.trim();
      if (!reason) return;
      body = { decision, comment: reason };
    } else if (decision === 'APPROVE') {
      const note = window.prompt('Комментарий (необязательно):')?.trim();
      if (note) body = { decision, approveComment: note };
    }
    setBusy(true);
    try {
      await apiFetch(`/api/certificates/${cert.id}/status`, { method: 'POST', body });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function saveDative(value: string | null) {
    if (!cert) return;
    try {
      const r = await apiFetch<{ fullNameDat: string }>(`/api/certificates/${cert.id}/dative-name`, {
        method: 'PATCH',
        body: { fullNameDat: value },
      });
      setCert({ ...cert, fullNameDat: r.fullNameDat });
      setEditingDative(false);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    }
  }

  if (error) return <div className="callout callout--danger"><span>{error}</span></div>;
  if (!cert) return <div className="muted">Загрузка…</div>;

  const printHref = cert.certType === 'MILITARY'
    ? `/certificates/${cert.id}/print-military`
    : `/certificates/${cert.id}/print`;

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 720 }}>
      <button onClick={() => router.back()} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> Назад
      </button>

      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          справка · {TYPE_LABELS[cert.certType]} · С-{cert.displayNo}
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', margin: 0, lineHeight: 1.1 }}>
          {cert.fullName}
        </h1>
        <div><span className={`badge ${STATUS_VARIANT[cert.status]}`}>{STATUS_LABELS[cert.status]}</span></div>
      </header>

      <div className="card col" style={{ padding: 'var(--s-5)', gap: 'var(--s-3)' }}>
        {/* ФИО в дательном падеже — для печатных форм. Авто-генерация через petrovich,
             оператор может скорректировать вручную или сбросить к авто-значению. */}
        <div className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            ФИО в дательном падеже{' '}
            <span style={{ opacity: 0.6 }}>(подставляется в печать)</span>
          </span>
          {editingDative ? (
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={dativeDraft}
                onChange={(e) => setDativeDraft(e.target.value)}
                placeholder="Иванову Ивану Ивановичу"
                autoFocus
              />
              <button className="btn btn--primary btn--sm" onClick={() => saveDative(dativeDraft.trim())} disabled={!dativeDraft.trim()}>
                <Check size={12} strokeWidth={1.75} /> Сохранить
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setEditingDative(false)}>
                <X size={12} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-14)', flex: 1, minWidth: 200 }}>
                {cert.fullNameDat ?? <span className="muted">не задано</span>}
              </span>
              <button className="btn btn--ghost btn--sm" onClick={() => { setDativeDraft(cert.fullNameDat ?? ''); setEditingDative(true); }}>
                <Pencil size={12} strokeWidth={1.75} /> Изменить
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => saveDative(null)} title="Пересчитать через petrovich">
                <RotateCcw size={12} strokeWidth={1.75} /> Пересчитать
              </button>
            </div>
          )}
        </div>

        <Field label="Дата рождения" value={fmtDate(cert.birthDate)} />
        <Field label="Группа" value={cert.groupName} mono />
        <Field label="Куда" value={cert.targetOrg} />
        <Field label="Телефон" value={cert.phone} mono />
        <Field label="Email" value={cert.email} />
        <Field label="Период" value={
          cert.periodFrom || cert.periodTo
            ? `${cert.periodFrom ? fmtDate(cert.periodFrom) : '…'} — ${cert.periodTo ? fmtDate(cert.periodTo) : '…'}`
            : '—'
        } />
        <Field label="Примечание студента" value={cert.comment ?? '—'} />
        <Field label="Комментарий статуса" value={cert.statusComment ?? '—'} />
        <Field label="ID в Max" value={cert.maxUserId ?? '—'} mono />
        <Field label="Создано" value={fmt(cert.createdAt)} />
        <Field label="Обновлено" value={fmt(cert.updatedAt)} />
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        {cert.status === 'APPROVED' && (
          <Link href={printHref} target="_blank" className="btn btn--ghost">
            <Printer size={14} strokeWidth={1.75} /> Печать
          </Link>
        )}
        {cert.status !== 'APPROVED' && (
          <button onClick={() => decide('APPROVE')} disabled={busy} className="btn btn--primary">Выдать</button>
        )}
        {cert.status !== 'REJECTED' && (
          <button onClick={() => decide('REJECT')} disabled={busy} className="btn btn--danger">Отклонить</button>
        )}
        {cert.status !== 'PENDING' && (
          <button onClick={() => decide('RESET')} disabled={busy} className="btn btn--ghost">Вернуть в работу</button>
        )}
        <Link href="/certificates" className="btn btn--ghost" style={{ marginLeft: 'auto' }}>К списку</Link>
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
  return new Date(iso).toLocaleString('ru-RU');
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}
