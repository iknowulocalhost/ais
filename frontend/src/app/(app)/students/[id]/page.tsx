'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Protected } from '@/components/protected';
import { StudentDocuments } from '@/components/student-documents';
import { StudentGrades } from '@/components/student-grades';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import {
  fmtDate,
  STUDENT_STATUS_LABELS,
  type Student,
  type StudentStatus,
} from '@/lib/domain';
import { clsx } from '@/components/clsx';

type Tab = 'docs' | 'grades';

const TABS: { key: Tab; label: string; code: string }[] = [
  { key: 'docs',   label: 'Документы',     code: 'doc' },
  { key: 'grades', label: 'Успеваемость',  code: 'grd' },
];

const STATUS_VARIANT: Record<StudentStatus, string> = {
  APPLICANT: '',
  ENROLLED: '',
  ACADEMIC_LEAVE: 'badge--warn',
  EXPELLED: 'badge--bad',
  GRADUATED: 'badge--ok',
};

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
  const [tab, setTab] = useState<Tab>('docs');

  useEffect(() => {
    let cancelled = false;
    apiFetch<Student>(`/api/students/${id}`)
      .then((s) => { if (!cancelled) setStudent(s); })
      .catch((e: unknown) => { if (!cancelled) setError(explainError(e).hint); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className="callout callout--danger" role="alert">
        <span className="icon">!</span>
        <span>{error}</span>
      </div>
    );
  }
  if (!student) return <StudentSkeleton />;

  const fullName = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  const initials = (student.lastName[0] ?? '') + (student.firstName[0] ?? '');

  return (
    <div className="col" style={{ gap: 'var(--s-6)' }}>
      {/* breadcrumb */}
      <nav className="row mono" style={{ alignItems: 'center', gap: 'var(--s-1)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
        <Link href="/students" style={{ color: 'inherit' }}>← студенты</Link>
        <span>/</span>
        <span style={{ color: 'var(--ais-bone-2)' }}>{shortId(student.id)}</span>
      </nav>

      {/* HEADER */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="row"
        style={{
          alignItems: 'flex-start',
          gap: 'var(--s-5)',
          borderBottom: '1px solid var(--ais-line)',
          paddingBottom: 'var(--s-5)',
        }}
      >
        {/* avatar */}
        <div
          className="avatar"
          style={{
            width: 72,
            height: 72,
            fontSize: 28,
            background: 'var(--ais-forest-wash)',
            color: 'var(--ais-forest-hi)',
          }}
        >
          {initials.toUpperCase() || '·'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--s-4)' }}>
            <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.05 }}>
              {fullName}
            </h1>
            <span className={`badge ${STATUS_VARIANT[student.status]}`}>
              {STUDENT_STATUS_LABELS[student.status]}
            </span>
          </div>

          <dl className="row" style={{ flexWrap: 'wrap', alignItems: 'baseline', gap: 'var(--s-1) var(--s-5)', marginTop: 'var(--s-4)' }}>
            <Meta k="д.р." v={fmtDate(student.birthDate)} />
            <Meta k="группа" v={student.groupId ? shortId(student.groupId) : '—'} />
            <Meta k="id" v={shortId(student.id)} mono />
            <Meta k="создан" v={fmtDate(student.createdAt)} />
          </dl>
        </div>
      </motion.header>

      {/* BODY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--s-6)', minWidth: 0 }}>
        {/* LEFT */}
        <div className="col" style={{ gap: 'var(--s-5)', minWidth: 0 }}>
          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s-2)', borderBottom: '1px solid var(--ais-line)' }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx('row')}
                style={{
                  position: 'relative',
                  alignItems: 'baseline',
                  gap: 'var(--s-1)',
                  padding: 'var(--s-2) var(--s-4)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: tab === t.key ? 'var(--ais-bone)' : 'var(--ais-bone-4)',
                  fontFamily: 'inherit',
                }}
              >
                <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
                  {t.code}
                </span>
                <span style={{ fontSize: 'var(--fs-14)' }}>{t.label}</span>
                {tab === t.key && (
                  <motion.span
                    layoutId="student-tab-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    style={{ position: 'absolute', left: 'var(--s-4)', right: 'var(--s-4)', bottom: -1, height: 2, background: 'var(--ais-forest)' }}
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            >
              {tab === 'docs'   && <StudentDocuments studentId={student.id} />}
              {tab === 'grades' && <StudentGrades    studentId={student.id} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT */}
        <aside className="col" style={{ gap: 'var(--s-5)' }}>
          <section className="card">
            <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
              сводка
            </span>
            <dl className="col" style={{ gap: 'var(--s-3)', marginTop: 'var(--s-4)' }}>
              <Summary k="средний балл" v="—" mono />
              <Summary k="задолженность" v="—" mono />
              <Summary k="документов" v="—" />
              <Summary k="статус" v={STUDENT_STATUS_LABELS[student.status]} />
            </dl>
          </section>

          <section className="card">
            <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
              действия
            </span>
            <div className="col" style={{ gap: 'var(--s-1)', marginTop: 'var(--s-4)' }}>
              <ActionRow label="изменить статус" hint="требует подтверждения" />
              <ActionRow label="перевести в группу" />
              <ActionRow label="история (аудит)" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ───────────────── helpers ───────────────── */

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s-1)' }}>
      <dt className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
        {k}
      </dt>
      <dd className={mono ? 'mono' : undefined} style={{ fontSize: 'var(--fs-13)', color: 'var(--ais-bone-2)' }}>
        {v}
      </dd>
    </div>
  );
}

function Summary({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: 'var(--s-2)',
        borderBottom: '1px solid var(--ais-line)',
      }}
    >
      <dt className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
        {k}
      </dt>
      <dd className={mono ? 'mono tnum' : undefined} style={{ fontSize: 'var(--fs-13)', color: 'var(--ais-bone)' }}>
        {v}
      </dd>
    </div>
  );
}

function ActionRow({ label, hint }: { label: string; hint?: string }) {
  return (
    <button
      type="button"
      className="row"
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: 'var(--s-2) var(--s-3)',
        background: 'none',
        border: '1px solid transparent',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--ais-bone)',
        fontFamily: 'inherit',
        fontSize: 'var(--fs-13)',
      }}
    >
      <span>{label}</span>
      {hint && (
        <span className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {hint}
        </span>
      )}
      <span className="mono muted" style={{ fontSize: 11 }}>→</span>
    </button>
  );
}

function StudentSkeleton() {
  return (
    <div className="col" style={{ gap: 'var(--s-6)' }}>
      <div style={{ height: 16, width: 200, borderRadius: 2, background: 'var(--ais-sub)' }} />
      <div
        className="row"
        style={{
          alignItems: 'center',
          gap: 'var(--s-5)',
          borderBottom: '1px solid var(--ais-line)',
          paddingBottom: 'var(--s-5)',
        }}
      >
        <div style={{ height: 72, width: 72, borderRadius: '50%', background: 'var(--ais-sub)' }} />
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div style={{ height: 40, width: 320, borderRadius: 2, background: 'var(--ais-sub)' }} />
          <div style={{ height: 12, width: 240, borderRadius: 2, background: 'var(--ais-sub)' }} />
        </div>
      </div>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
