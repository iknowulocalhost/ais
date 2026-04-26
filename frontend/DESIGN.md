# АИС: Студенты — Дизайн-система

**Версия 1.0 · тёмная бумажная палитра**

Дизайн-система АИС живёт в двух файлах:

- [`src/styles/design-system/tokens.css`](src/styles/design-system/tokens.css) —
  токены: палитра (surfaces, ink, brand, accents), типографика (Inter +
  JetBrains Mono), spacing (4px-база), радиусы, тени, кривые анимации, темы
  `dark` (по умолчанию) и `light` (`[data-theme="light"]`).
- [`src/styles/design-system/components.css`](src/styles/design-system/components.css) —
  готовые классы: `.btn`, `.input`, `.field`, `.card`, `.badge`, `.tag`,
  `.grade`, `.table`, `.sidebar`, `.nav`, `.modal`, `.tip`, `.popover`, `.kbd`,
  `.progress`, `.sticker`, `.avatar`, `.segmented`, `.stat`, `.callout`,
  `.divider`, `.paper-grain` и набор утилит (`.mono`, `.muted`, `.row`, `.col`,
  `.grow`, `.tnum`, `.display`).

Оба файла импортируются в [`src/app/globals.css`](src/app/globals.css). Там же —
мост совместимости: старые имена (`--canvas`, `--ink`, `--accent`, `--alarm`,
tailwind-классы `bg-canvas`, `text-ink-3`, `p-t-8` и т. п.) перенаправлены на
новую палитру, чтобы страницы, написанные до смены системы, продолжали
работать и автоматически получали новые цвета и шрифты.

## Основные принципы

- **Одна палитра на тему.** Тёмная по умолчанию, светлая — через
  `data-theme="light"` на `<html>`. Обе используют один набор переменных.
- **Один зелёный для brand/ok, один терракот для критических сигналов.**
  Оттенков больше, но их роль фиксирована в `--ais-forest` / `--ais-ember`.
- **Оценки — отдельная семантика.** `--grade-5..2..n` различимы не только
  яркостью, но и оттенком: «хорошо» не равно «отлично», «н/а» пунктирная.
- **Сетка 4px** (`--s-1..11`, spacing-префикс `s-*` в Tailwind). Старая
  «музыкальная» шкала `t-*` оставлена только как мост для ранее написанных
  страниц; новые экраны должны брать spacing из `s-*`.
- **Шрифты.** Inter для UI и заголовков, JetBrains Mono для числовых полей,
  ID, timestamps, caps-меток. Variable/opsz-игрища удалены — формы оставлены
  гарнитурам.

## Как добавлять экраны

1. Новые компоненты собираются из классов `components.css`, не из `@layer
   components` в `globals.css`.
2. Если нужен новый паттерн — расширять `components.css`, а не дублировать
   стили в страницах. Inline-стили (через `style={{...}}`) допустимы только
   для уникальных одноразовых раскладок.
3. Тёмную/светлую темы проверять через `document.documentElement.dataset.theme
   = 'light'` в DevTools.
