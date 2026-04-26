'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  type DocumentKind,
  type DocumentStatus,
  type StudentDocument,
} from '@/lib/domain';

const KINDS = Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[];

const DOC_STATUS_VARIANT: Record<DocumentStatus, string> = {
  PENDING: '',
  UPLOADED: 'badge--warn',
  VERIFIED: 'badge--ok',
  REJECTED: 'badge--bad',
};

interface InitResponse {
  id: string;
  objectKey: string;
  uploadUrl: string;
  ttlSeconds: number;
}

/**
 * Двухфазная загрузка:
 *   1) POST /api/students/:id/documents → backend вернёт presigned PUT URL
 *   2) PUT <uploadUrl> напрямую в MinIO (браузер → MinIO, минуя API)
 *   3) POST /api/documents/:id/complete
 */
export function StudentDocuments({ studentId }: { studentId: string }) {
  const { hasRole } = useAuth();
  const canVerify = hasRole(['ADM', 'COM']);
  const canUpload = hasRole(['ADM', 'COM', 'STU']);

  const [docs, setDocs] = useState<StudentDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<StudentDocument[]>(`/api/students/${studentId}/documents`);
      setDocs(d);
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function onPick(kind: DocumentKind, file: File) {
    setUploading(true);
    setError(null);
    try {
      const init = await apiFetch<InitResponse>(`/api/students/${studentId}/documents`, {
        method: 'POST',
        body: {
          kind,
          originalName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });
      const putRes = await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`MinIO PUT: HTTP ${putRes.status}`);
      await apiFetch(`/api/documents/${init.id}/complete`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(explainError(e).hint);
    } finally {
      setUploading(false);
    }
  }

  async function verify(doc: StudentDocument, approve: boolean) {
    const reason = approve ? undefined : window.prompt('Причина отклонения:')?.trim();
    if (!approve && !reason) return;
    try {
      await apiFetch(`/api/documents/${doc.id}/verify`, {
        method: 'POST',
        body: { outcome: approve ? 'APPROVE' : 'REJECT', reason },
      });
      await load();
    } catch (e) {
      alert(explainError(e).hint);
    }
  }

  async function download(doc: StudentDocument) {
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/documents/${doc.id}/download-url`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert(explainError(e).hint);
    }
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="display" style={{ fontSize: 'var(--fs-20)' }}>Документы</h2>
        {canUpload && <UploadMenu disabled={uploading} onPick={onPick} />}
      </div>

      {error && <div className="callout callout--danger" style={{ marginTop: 'var(--s-3)' }}><span>{error}</span></div>}

      <div className="card card--bleed" style={{ marginTop: 'var(--s-3)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Файл</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => (
              <tr key={d.id}>
                <td>{DOCUMENT_KIND_LABELS[d.kind]}</td>
                <td>
                  <button
                    onClick={() => download(d)}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ais-forest-hi)', cursor: 'pointer' }}
                  >
                    {d.originalName}
                  </button>
                  {d.rejectionReason && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ais-ember)', marginTop: 2 }}>
                      Отказ: {d.rejectionReason}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${DOC_STATUS_VARIANT[d.status]}`}>
                    {DOCUMENT_STATUS_LABELS[d.status]}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {canVerify && d.status === 'UPLOADED' && (
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
                      <button onClick={() => verify(d, true)} className="btn btn--primary btn--sm">
                        Принять
                      </button>
                      <button onClick={() => verify(d, false)} className="btn btn--danger btn--sm">
                        Отклонить
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {docs && docs.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 'var(--s-5)' }}>
                  Документов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UploadMenu({
  onPick,
  disabled,
}: {
  onPick: (kind: DocumentKind, file: File) => void;
  disabled: boolean;
}) {
  const [kind, setKind] = useState<DocumentKind>('PASSPORT');
  return (
    <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as DocumentKind)}
        className="input"
        style={{ width: 'auto' }}
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>{DOCUMENT_KIND_LABELS[k]}</option>
        ))}
      </select>
      <label className={`btn btn--primary btn--sm ${disabled ? 'is-disabled' : ''}`} style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
        {disabled ? 'Загрузка…' : 'Загрузить'}
        <input
          type="file"
          hidden
          accept="image/*,application/pdf"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(kind, f);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
