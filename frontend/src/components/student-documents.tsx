'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  type DocumentKind,
  type StudentDocument,
} from '@/lib/domain';

const KINDS = Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[];

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
      setError((e as Error).message);
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
      // Прямой PUT в MinIO — НЕ через apiFetch (другой хост, свои заголовки).
      const putRes = await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`MinIO PUT: HTTP ${putRes.status}`);
      await apiFetch(`/api/documents/${init.id}/complete`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
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
      alert((e as Error).message);
    }
  }

  async function download(doc: StudentDocument) {
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/documents/${doc.id}/download-url`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Документы</h2>
        {canUpload && (
          <UploadMenu disabled={uploading} onPick={onPick} />
        )}
      </div>

      {error && <div className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="mt-3 overflow-hidden rounded-md ring-1 ring-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Тип</th>
              <th className="px-3 py-2 font-medium">Файл</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(docs ?? []).map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2">{DOCUMENT_KIND_LABELS[d.kind]}</td>
                <td className="px-3 py-2 text-slate-700">
                  <button onClick={() => download(d)} className="text-blue-700 hover:underline">
                    {d.originalName}
                  </button>
                  {d.rejectionReason && (
                    <div className="text-xs text-rose-700">Отказ: {d.rejectionReason}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${DOCUMENT_STATUS_COLORS[d.status]}`}>
                    {DOCUMENT_STATUS_LABELS[d.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {canVerify && d.status === 'UPLOADED' && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => verify(d, true)}
                        className="text-xs text-emerald-700 hover:underline">Принять</button>
                      <button onClick={() => verify(d, false)}
                        className="text-xs text-rose-700 hover:underline">Отклонить</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {docs && docs.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Документов пока нет</td></tr>
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
    <label className="flex items-center gap-2">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as DocumentKind)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>{DOCUMENT_KIND_LABELS[k]}</option>
        ))}
      </select>
      <span
        className={`cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white ${
          disabled ? 'opacity-60' : 'hover:bg-blue-700'
        }`}
      >
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
      </span>
    </label>
  );
}
