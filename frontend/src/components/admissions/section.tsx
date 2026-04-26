'use client';

import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { clsx } from '../clsx';

interface Props {
  index?: number; // не используется, оставлено для обратной совместимости вызовов
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  required?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function FormSection({
  icon: Icon,
  title,
  subtitle,
  required,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const optional = !required;

  return (
    <section
      className="card"
      style={{
        padding: 0,
        borderColor: optional ? 'var(--ais-line)' : undefined,
        background: optional ? 'transparent' : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="row section-toggle"
        style={{
          width: '100%',
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          alignItems: 'center',
          gap: 'var(--s-4)',
          padding: 'var(--s-4) var(--s-5)',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-8)',
            background: 'var(--ais-paper-2)',
            color: 'var(--ais-bone-2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={1.6} />
        </span>

        <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--fs-15)',
              fontWeight: 600,
              color: optional ? 'var(--ais-bone-2)' : 'var(--ais-bone)',
            }}
          >
            {title}
          </h2>
          {subtitle && <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>{subtitle}</span>}
        </div>

        <span className={clsx('badge', required && 'badge--bad')}>
          <span className="dot" />
          {required ? 'Обязательно' : 'Опционально'}
        </span>

        <ChevronDown
          size={16}
          strokeWidth={1.75}
          style={{
            color: 'var(--ais-bone-3)',
            transition: 'transform var(--dur) var(--ease-out)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            flexShrink: 0,
          }}
        />
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows var(--dur) var(--ease-out)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ borderTop: '1px solid var(--ais-line)', padding: 'var(--s-5)' }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
