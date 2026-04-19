'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { StudentDocuments } from '@/components/student-documents';
import { StudentPayments } from '@/components/student-payments';
import { StudentGrades } from '@/components/student-grades';
import { apiFetch } from '@/lib/api';
import {
  fmtDate,
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
  type Student,
} from '@/lib/domain';

export default function StudentDetailPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'COM', 'STU', 'ANA', 'ACC']}>
      <StudentDetail />
    </Protected>
  );
}

function StudentDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [student, setStudent] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Student>(`/api/students/${id}`)
      .then((s) => { if (!cancelled) setStudent(s); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!student) return <div className="text-slate-500">Загрузка…</div>;

  const fullName = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      <header className="rounded-lg bg-white p-6 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Дата рождения: {fmtDate(student.birthDate)}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm ${STUDENT_STATUS_COLORS[student.status]}`}>
            {STUDENT_STATUS_LABELS[student.status]}
          </span>
        </div>
      </header>

      <StudentDocuments studentId={student.id} />
      <StudentPayments studentId={student.id} />
      <StudentGrades studentId={student.id} />
    </div>
  );
}
