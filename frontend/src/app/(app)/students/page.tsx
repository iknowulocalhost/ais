'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import {
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
  type Student,
  type StudentStatus,
} from '@/lib/domain';

interface Page { items: Student[]; total: number }

export default function StudentsPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'COM', 'ANA']}>
      <StudentsList />
    </Protected>
  );
}

function StudentsList() {
  const [status, setStatus] = useState<StudentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<Page>('/api/students', {
        query: { status: status || undefined, search: search || undefined, limit: 100 },
      });
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250); // debounce для поиска
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Студенты</h1>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО…"
            className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus | '')}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Все статусы</option>
            {(Object.keys(STUDENT_STATUS_LABELS) as StudentStatus[]).map((s) => (
              <option key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {data && <span className="text-sm text-slate-500">всего: {data.total}</span>}
        </div>
      </div>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!data ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">ФИО</th>
                <th className="px-4 py-2 font-medium">Дата рождения</th>
                <th className="px-4 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/students/${s.id}`} className="text-blue-700 hover:underline">
                      {s.lastName} {s.firstName} {s.middleName ?? ''}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {new Date(s.birthDate).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STUDENT_STATUS_COLORS[s.status]}`}>
                      {STUDENT_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
