'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Video, VideoOff, Info, Upload } from 'lucide-react';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1024;

async function fileToSquareDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const out = Math.min(side, MAX_SIDE);
    const c = document.createElement('canvas');
    c.width = out;
    c.height = out;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

const RULES = [
  'Лицо строго по центру кадра, прямо в камеру',
  'Нейтральный однотонный фон без посторонних предметов',
  'Без головных уборов и тёмных очков',
  'Хорошее равномерное освещение, без резких теней',
  'Нейтральное выражение лица, глаза открыты',
];

/**
 * Захват фото с веб-камеры.
 * Поток держим только когда камера запущена; остановка — по unmount или повторному снимку.
 * Снимок и live-превью используют одинаковую обводку и aspect-ratio 4/3.
 */
export function WebcamCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError('Допустимые форматы: PNG, JPEG, WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Файл больше 5 МБ');
      return;
    }
    try {
      stopStream();
      const dataUrl = await fileToSquareDataUrl(file);
      onChange(dataUrl);
    } catch {
      setError('Не удалось обработать изображение');
    }
  }

  useEffect(() => () => stopStream(), []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setError('Не удалось открыть камеру. Проверьте разрешения браузера.');
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - side) / 2;
    const sy = (v.videoHeight - side) / 2;
    const c = document.createElement('canvas');
    c.width = side;
    c.height = side;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, sx, sy, side, side, 0, 0, side, side);
    onChange(c.toDataURL('image/jpeg', 0.85));
    stopStream();
  }

  function reset() {
    onChange(null);
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--s-5)',
        alignItems: 'start',
      }}
    >
      {/* LEFT — превью / снимок */}
      <div className="col" style={{ gap: 'var(--s-3)' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: 'var(--ais-paper-2)',
            border: '1px solid var(--ais-line)',
            borderRadius: 'var(--r-8)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Снимок" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: active ? 'block' : 'none',
              }}
            />
          )}

          {/* Рамка-направляющая для лица — поверх превью */}
          {!value && active && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '12%',
                bottom: '12%',
                left: '50%',
                width: '52%',
                transform: 'translateX(-50%)',
                border: '1.5px dashed rgba(143,179,136,0.7)',
                borderRadius: '50% / 60%',
                pointerEvents: 'none',
              }}
            />
          )}

          {!value && !active && (
            <div className="col" style={{ alignItems: 'center', gap: 'var(--s-2)', color: 'var(--ais-bone-3)' }}>
              <VideoOff size={32} strokeWidth={1.5} />
              <span style={{ fontSize: 'var(--fs-13)' }}>Камера выключена</span>
            </div>
          )}
        </div>

        {error && <div className="field__error">{error}</div>}

        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          {!value && !active && (
            <>
              <button type="button" className="btn btn--outline" onClick={start} style={{ flex: 1 }}>
                <Video size={14} strokeWidth={1.75} /> Включить камеру
              </button>
              <button type="button" className="btn btn--ghost" onClick={pickFile} style={{ flex: 1 }}>
                <Upload size={14} strokeWidth={1.75} /> Загрузить с компьютера
              </button>
            </>
          )}
          {!value && active && (
            <>
              <button type="button" className="btn btn--primary" onClick={snap} style={{ flex: 1 }}>
                <Camera size={14} strokeWidth={2} /> Сделать снимок
              </button>
              <button type="button" className="btn btn--ghost" onClick={stopStream}>
                Отмена
              </button>
            </>
          )}
          {value && (
            <>
              <button type="button" className="btn btn--outline" onClick={reset} style={{ flex: 1 }}>
                <RotateCcw size={14} strokeWidth={1.75} /> Переснять
              </button>
              <button type="button" className="btn btn--ghost" onClick={pickFile}>
                <Upload size={14} strokeWidth={1.75} /> Заменить файлом
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* RIGHT — памятка */}
      <aside
        className="card"
        style={{
          padding: 'var(--s-5)',
          background: 'var(--ais-paper-2)',
        }}
      >
        <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
          <Info size={16} strokeWidth={1.75} style={{ color: 'var(--ais-forest)' }} />
          <h3 style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 600 }}>Требования к снимку</h3>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s-2)',
          }}
        >
          {RULES.map((r, i) => (
            <li
              key={i}
              className="row"
              style={{ alignItems: 'flex-start', gap: 'var(--s-2)', fontSize: 'var(--fs-13)', color: 'var(--ais-bone-2)' }}
            >
              <span
                style={{
                  marginTop: 7,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--ais-bone-4)',
                  flexShrink: 0,
                }}
              />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p
          className="muted"
          style={{
            margin: 'var(--s-4) 0 0',
            fontSize: 'var(--fs-12)',
            lineHeight: 1.5,
          }}
        >
          Снимок будет сохранён в зашифрованном виде вместе с карточкой и используется только для личного дела.
        </p>
      </aside>
    </div>
  );
}
