'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface CommentOption {
  id: string;
  title: string;
  text: string;
  isDefault: boolean;
}

interface Props {
  title: string;
  required?: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

/**
 * Модалка выбора комментария: либо из справочника, либо произвольный.
 * Используется при выдаче/отклонении пропусков и справок.
 */
export function CommentPickerModal({ title, required, onCancel, onSubmit }: Props) {
  const [options, setOptions] = useState<CommentOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    apiFetch<CommentOption[]>('/api/comment-options')
      .then((opts) => {
        setOptions(opts);
        const def = opts.find((o) => o.isDefault);
        if (def) setSelectedId(def.id);
      })
      .catch(() => setOptions([]));
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let text = custom.trim();
    if (!text && selectedId) {
      const opt = options.find((o) => o.id === selectedId);
      if (opt) text = opt.text;
    }
    if (required && !text) return;
    onSubmit(text);
  }

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-4)',
    }}>
      <form className="card col" onClick={(e) => e.stopPropagation()} onSubmit={submit}
            style={{ maxWidth: 480, width: '100%', padding: 'var(--s-5)', gap: 'var(--s-3)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-20)', margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onCancel}><X size={16} /></button>
        </div>

        {options.length > 0 && (
          <label className="col" style={{ gap: 'var(--s-1)' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Из справочника</span>
            <select className="input" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setCustom(''); }}>
              <option value="">— не выбрано —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
            {selectedId && !custom && (
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                {options.find((o) => o.id === selectedId)?.text}
              </span>
            )}
          </label>
        )}

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            Свой комментарий {required ? '(обязателен, если ничего не выбрано из справочника)' : '(необязательно)'}
          </span>
          <textarea className="input" rows={3} value={custom} onChange={(e) => setCustom(e.target.value)} />
        </label>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Отмена</button>
          <button type="submit" className="btn btn--primary"
                  disabled={required && !custom.trim() && !selectedId}>
            Подтвердить
          </button>
        </div>
      </form>
    </div>
  );
}
