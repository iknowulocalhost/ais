import type { Config } from 'tailwindcss';

/**
 * АИС:Студент — Tailwind-карта, привязанная к дизайн-системе в
 * /src/styles/design-system (tokens.css + components.css).
 *
 * Всё берётся через CSS-переменные --ais-*. Старые имена (canvas/ink/t-*)
 * и бридж удалены: страницы теперь используют components.css напрямую.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'ais-ink':      'var(--ais-ink)',
        'ais-paper':    'var(--ais-paper)',
        'ais-paper-2':  'var(--ais-paper-2)',
        'ais-line':     'var(--ais-line)',
        'ais-line-2':   'var(--ais-line-2)',
        'ais-bone':     'var(--ais-bone)',
        'ais-bone-2':   'var(--ais-bone-2)',
        'ais-bone-3':   'var(--ais-bone-3)',
        'ais-bone-4':   'var(--ais-bone-4)',
        'ais-forest':   'var(--ais-forest)',
        'ais-forest-d': 'var(--ais-forest-d)',
        'ais-ivy':      'var(--ais-ivy)',
        'ais-ivy-2':    'var(--ais-ivy-2)',
        'ais-ember':    'var(--ais-ember)',
        'ais-ember-d':  'var(--ais-ember-d)',
        'ais-ochre':    'var(--ais-ochre)',
        'ais-ochre-d':  'var(--ais-ochre-d)',
        'ais-bloom':    'var(--ais-bloom)',
        'ais-info':     'var(--ais-info)',
        'grade-5':      'var(--grade-5)',
        'grade-4':      'var(--grade-4)',
        'grade-3':      'var(--grade-3)',
        'grade-2':      'var(--grade-2)',
        'grade-n':      'var(--grade-n)',
      },
      spacing: {
        's-1':  '4px',
        's-2':  '8px',
        's-3':  '12px',
        's-4':  '16px',
        's-5':  '20px',
        's-6':  '24px',
        's-7':  '32px',
        's-8':  '40px',
        's-9':  '56px',
        's-10': '72px',
        's-11': '96px',
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'fs-12': ['12px', { lineHeight: '1.4'  }],
        'fs-13': ['13px', { lineHeight: '1.45' }],
        'fs-14': ['14px', { lineHeight: '1.5'  }],
        'fs-15': ['15px', { lineHeight: '1.5'  }],
        'fs-16': ['16px', { lineHeight: '1.5'  }],
        'fs-18': ['18px', { lineHeight: '1.4'  }],
        'fs-22': ['22px', { lineHeight: '1.3'  }],
        'fs-28': ['28px', { lineHeight: '1.2'  }],
        'fs-36': ['36px', { lineHeight: '1.15' }],
        'fs-48': ['48px', { lineHeight: '1.08' }],
        'fs-64': ['64px', { lineHeight: '1.02' }],
      },
      borderRadius: {
        'r-2':   '2px',
        'r-4':   '4px',
        'r-6':   '6px',
        'r-8':   '8px',
        'r-10':  '10px',
        'r-14':  '14px',
        'r-20':  '20px',
      },
      boxShadow: {
        ais1:      'var(--shadow-1)',
        ais2:      'var(--shadow-2)',
        ais3:      'var(--shadow-3)',
        'ais-pop': 'var(--shadow-pop)',
      },
      transitionTimingFunction: {
        out:      'cubic-bezier(0.2, 0.7, 0.2, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '360ms',
      },
    },
  },
  plugins: [],
};

export default config;
