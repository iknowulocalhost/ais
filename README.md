# АИС: Студенты

Корпоративная веб-ориентированная платформа для учебных заведений.
Этап 1 — каркас инфраструктуры и базовые модули (Users, Audit Log).

## Архитектура

Монорепозиторий с двумя приложениями и единым Docker Compose:

```
AISStudent/
├── docker-compose.yml            # базовая композиция всех сервисов
├── docker-compose.dev.yml        # override для локальной разработки (hot-reload)
├── .env.example                  # шаблон переменных окружения
├── infra/
│   └── postgres/init/            # init-скрипты Postgres (расширения)
├── backend/                      # NestJS API (Clean Architecture)
│   ├── src/
│   │   ├── domain/               # сущности, enum, порты репозиториев
│   │   ├── application/          # use-cases, сервисы приложения
│   │   ├── infrastructure/       # TypeORM, Argon2, миграции
│   │   └── presentation/         # HTTP контроллеры, DTO
│   ├── Dockerfile                # multi-stage: dev / build / production
│   └── package.json
└── frontend/                     # Next.js 14 (App Router), Tailwind, Framer Motion
    ├── src/app/
    ├── Dockerfile
    └── package.json
```

### Слои backend (Clean Architecture)

| Слой              | Отвечает за                                          | Зависит от             |
|-------------------|------------------------------------------------------|------------------------|
| `domain`          | Бизнес-сущности, enum ролей, интерфейсы репозиториев | ничего                 |
| `application`     | Use-cases, оркестрация (CreateUser, AuditService)    | domain                 |
| `infrastructure`  | TypeORM, Argon2id, миграции, DI-модули              | domain, application    |
| `presentation`    | HTTP-контроллеры, DTO, валидация                     | application, domain    |

Domain-слой не импортирует ничего из NestJS, TypeORM или Argon2 — только POJO и интерфейсы.

## Технологический стек

- **Frontend:** TypeScript · React 18 · Next.js 14 (SSR/CSR) · Tailwind CSS · Framer Motion
- **Backend:** TypeScript · NestJS 10 · TypeORM · JWT (passport) · Argon2id
- **БД:** PostgreSQL 15 + TimescaleDB (одним образом `timescale/timescaledb:latest-pg15`)
- **Кэш / сессии:** Redis 7
- **Файловое хранилище:** MinIO (S3-совместимое)
- **Аудит:** TimescaleDB hypertable `audit_logs` (чанки по 7 дней)

## Ролевая модель

`SUPERADMIN`, `ADM`, `ACC`, `COM`, `INF`, `TEA`, `ANA`, `PHO`, `STU` — заданы в
[role.enum.ts](backend/src/domain/enums/role.enum.ts) и в Postgres-enum `users_roles_enum`.
У пользователя может быть несколько ролей (массив).

## Безопасность и 152-ФЗ

- Пароли хранятся только как хеш Argon2id (`memoryCost=19456, timeCost=2`) —
  см. [argon2-password-hasher.ts](backend/src/infrastructure/security/argon2-password-hasher.ts).
- Все мутации критичных сущностей пишутся в `audit_logs` с полями
  `old_state` / `new_state` (JSONB), `ip_address` (INET), `user_agent`, `actor_id`.
- `password_hash` **не попадает** в snapshots аудита.
- Hypertable позволяет дешево хранить аудит годами и применять retention-политики
  (`add_retention_policy`) на следующих этапах.

## Запуск инфраструктуры

### 1. Подготовка

Требуется Docker Desktop (Windows/macOS) или Docker Engine 24+ (Linux) с плагином Compose.

```bash
cp .env.example .env
# отредактируйте .env: минимум смените JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD.
```

### 2. Режим разработки (hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Доступно:
- Frontend (Next.js):        http://localhost:3000
- Backend API:               http://localhost:3001/api
- Health-check:              http://localhost:3001/api/health
- Postgres:                  localhost:5432  (user: `ais`, db: `ais_students`)
- Redis:                     localhost:6379  (auth: `REDIS_PASSWORD`)
- MinIO API:                 http://localhost:9000
- MinIO Console:             http://localhost:9001  (логин: `MINIO_ROOT_USER`)

### 3. Продакшен-сборка

```bash
docker compose up -d --build
```

Стадии `production` в Dockerfile бэкенда и фронта собирают минимальный образ
(nest build → `node dist/main.js`; next build → `standalone`).

### 4. Миграции БД

После первого запуска Postgres выполните миграцию:

```bash
docker compose exec backend npm run migration:run
```

Миграция [`InitSchema1713000000000`](backend/src/infrastructure/database/migrations/1713000000000-InitSchema.ts)
создаёт расширения (`timescaledb`, `pgcrypto`), таблицу `users`, enum ролей,
таблицу `audit_logs` и превращает её в hypertable.

### 5. Проверка API

```bash
# health
curl http://localhost:3001/api/health

# создать пользователя
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@example.com",
    "password":"StrongPass!2345",
    "firstName":"Иван",
    "lastName":"Иванов",
    "roles":["ADM"]
  }'
```

Факт создания попадёт в `audit_logs` с `action = 'CREATE'`, `entity = 'User'`,
и заполненным `ip_address` из запроса.

## Аутентификация и RBAC (этап 2)

### Модель токенов

- **Access** JWT: короткий TTL (`JWT_ACCESS_TTL`, default 15m), содержит `{ sub, email, roles }`.
- **Refresh** JWT: долгий TTL (`JWT_REFRESH_TTL`, default 7d), содержит `{ sub, jti }`.
- Refresh регистрируется в Redis: `refresh:{userId}:{jti}` → `sha256(token)` с TTL.
- **Ротация**: при `/auth/refresh` старый `jti` удаляется, выдаётся новая пара.
- **Reuse-detection**: если пришедший refresh-токен прошёл подпись, но отсутствует в Redis,
  считаем компрометацией и сбрасываем ВСЕ сессии пользователя (`revokeAll`).

### Глобальные гварды

В `AppModule` зарегистрированы через `APP_GUARD`:
1. `JwtAuthGuard` — требует `Authorization: Bearer <access>`; пропускает эндпоинты с `@Public()`.
2. `RolesGuard` — если на хендлере/классе стоит `@Roles(...)`, проверяет их;
   `SUPERADMIN` всегда проходит.

Декораторы: `@Public()`, `@Roles(Role.ADM, Role.ANA)`, `@CurrentUser()`.

### Bootstrap первого администратора

Если задать `SUPERADMIN_EMAIL` и `SUPERADMIN_PASSWORD` в `.env`, при первом старте backend
создаст SUPERADMIN (если в таблице ещё нет ни одного пользователя с таким email). Это
единственный способ получить первого актора — любой вызов `POST /api/users` требует роли ADM.

### Эндпоинты

| Метод | URL                 | Доступ        | Назначение                           |
|-------|---------------------|---------------|--------------------------------------|
| GET   | `/api/health`       | public        | healthcheck                          |
| POST  | `/api/auth/login`   | public        | логин → `{accessToken, refreshToken, user}` |
| POST  | `/api/auth/refresh` | public        | ротация refresh-токена               |
| POST  | `/api/auth/logout`  | auth          | отзыв текущего refresh                |
| GET   | `/api/users/me`     | auth          | профиль текущего пользователя        |
| POST  | `/api/users`        | ADM (+SUPER)  | создание пользователя                |
| GET   | `/api/users`        | ADM, ANA      | список (заглушка — этап 3)            |

### Пример flow

```bash
# 1. Логин
TOKENS=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ais.local","password":"ChangeMeOnFirstLogin!2026"}')
ACCESS=$(echo $TOKENS | jq -r .accessToken)
REFRESH=$(echo $TOKENS | jq -r .refreshToken)

# 2. Защищённый запрос
curl http://localhost:3001/api/users/me -H "Authorization: Bearer $ACCESS"

# 3. Создание пользователя (требует роль ADM/SUPERADMIN)
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" \
  -d '{"email":"t@ex.com","password":"StrongPass!2345","firstName":"T","lastName":"U","roles":["TEA"]}'

# 4. Ротация
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}"
```

Все события (`LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `CREATE User`) пишутся в `audit_logs`
с IP и user-agent вызвавшего.

## Этап 3 — Студенты, файлы, фоновые задачи

### Домен
- [Student](backend/src/domain/entities/student.entity.ts) со статусами `APPLICANT`/`ENROLLED`/`ACADEMIC_LEAVE`/`EXPELLED`/`GRADUATED`.
- [Group](backend/src/domain/entities/group.entity.ts) с FK на куратора (`TEA`).
- Порт [ObjectStorage](backend/src/domain/services/object-storage.ts) — бакеты `avatars`, `documents`.

### MinIO
- [MinioObjectStorage](backend/src/infrastructure/storage/minio-object-storage.ts): при старте создаёт недостающие бакеты, отдаёт presigned URL (GET/PUT).
- `GET /api/students/:id/avatar-url` отдаёт подписанный URL с TTL 15 мин — браузер качает аватар напрямую из MinIO, минуя API.

### Фоновые задачи (BullMQ поверх Redis)
- Очередь `avatar-processing`, процессор [AvatarProcessor](backend/src/infrastructure/queue/processors/avatar.processor.ts) генерирует derivative 256×256 WebP через `sharp`.
- `POST /api/students/:id/avatar` отвечает сразу, ресайз уходит в очередь с retry (exponential backoff, 3 попытки). Основной HTTP-поток не блокируется.

### Rate-limiting (Redis-based)
- [ThrottlerModule](backend/src/infrastructure/throttler/throttler.module.ts) с собственным `ThrottlerStorageRedisService` — лимит работает в кластере.
- Дефолт: 120 запросов/минуту/IP. На `POST /api/auth/login` — 10/мин (жёсткий антибрут).

### Смена пароля и отзыв сессий
- [ChangePasswordUseCase](backend/src/application/use-cases/auth/change-password.use-case.ts) при успешной смене вызывает `RefreshTokenStore.revokeAll(userId)` → все устройства выкидывает.
- Эндпоинт: `POST /api/auth/change-password` (auth-only).

### Retention для аудита
Миграция [StudentsGroups1713100000000](backend/src/infrastructure/database/migrations/1713100000000-StudentsGroups.ts) включает `add_retention_policy('audit_logs', INTERVAL '3 years')`: TimescaleDB автоматически дропает чанки старше 3 лет. Срок можно менять.

### Новые эндпоинты (этап 3)

| Метод | URL                                | Доступ                  | Назначение                             |
|-------|------------------------------------|-------------------------|----------------------------------------|
| POST  | `/api/auth/change-password`        | auth                    | смена пароля + revokeAll                |
| POST  | `/api/students`                    | ADM, COM                | создать карточку студента               |
| GET   | `/api/students`                    | ADM, TEA, ANA, COM      | список с фильтрами `status/groupId/search` |
| GET   | `/api/students/:id`                | ADM, TEA, COM, STU, ANA | получить студента                       |
| POST  | `/api/students/:id/avatar`         | ADM, PHO, STU           | загрузить аватар (multipart, <=5 MiB)   |
| GET   | `/api/students/:id/avatar-url`     | ADM, TEA, STU           | presigned URL на скачивание            |

### Пример — загрузка аватара

```bash
curl -X POST http://localhost:3001/api/students/<id>/avatar \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@avatar.png;type=image/png"
# → { "objectKey": "<uuid>/<uuid>.png", "jobId": "1" }
# В логах backend: [AvatarProcessor] [job 1] Resize avatar ... → Done
```

## Этап 4 — Документы, платежи, отчёты, RequestContext, Bull Board

### Документы студентов (двухфазная загрузка напрямую в MinIO)
Файлы не проходят через backend — клиент PUT'ит в MinIO по presigned URL. Backend только валидирует мета-данные и хранит запись.

1. `POST /api/documents/init-upload` → `{ objectKey, uploadUrl }` (TTL 10 мин). Backend проверяет mime (`image/png|jpeg|application/pdf`) и размер (<=20 MiB), создаёт `student_documents` запись со статусом `UPLOADED`.
2. Клиент делает `PUT <uploadUrl>` с телом файла напрямую в MinIO.
3. `POST /api/documents/:id/complete` — подтверждение (проверяет, что объект реально лёг в бакет).
4. `POST /api/documents/:id/verify` — верификация сотрудником (`COM`/`ADM`): `VERIFIED` или `REJECTED` с `reason`.

Сущность: [StudentDocument](backend/src/domain/entities/student-document.entity.ts) с инвариантами (нельзя verify уже rejected и т.д.).

### Платежи (ACC)
- Деньги в копейках (`BIGINT` + TypeORM transformer → `bigint`). JSON возвращает суммы строками, чтобы не поломать `Number.MAX_SAFE_INTEGER`.
- Жизненный цикл: `PENDING → PAID | CANCELLED | REFUNDED`, инварианты в [Payment](backend/src/domain/entities/payment.entity.ts) (`markPaid`/`cancel`/`refund`).
- `POST /api/payments` (ACC/ADM) — выставить начисление студенту.
- `GET /api/payments?studentId=&status=` — список с пагинацией.
- `GET /api/students/:id/payments/balance` — сумма неоплаченного.
- `POST /api/payments/:id/mark-paid` — закрыть (с опциональным `externalRef`).

### Асинхронный экспорт отчётов (ANA)
Экспорты идут фоном: `exceljs` пишет XLSX стримом, БД читается постранично (500 строк/страница) → память константна на любом объёме.

1. `POST /api/reports/exports` с `{ kind: "STUDENTS" | "PAYMENTS", filters? }` → `{ id, status: "QUEUED" }`.
2. Процессор [ReportExportProcessor](backend/src/infrastructure/queue/processors/report-export.processor.ts) обрабатывает, кладёт итог в бакет `documents` под ключом `exports/<id>.xlsx`, обновляет запись в `report_exports` (`RUNNING → READY | FAILED`).
3. `GET /api/reports/exports/:id` возвращает статус и, если `READY`, presigned GET URL на скачивание (TTL 15 мин).

Владелец проверяется по `actorId` — чужие экспорты читать нельзя.

### RequestContext (AsyncLocalStorage)
Вместо протаскивания `ctx(req, ip, actor)` через все слои — глобальный [RequestContext](backend/src/infrastructure/context/request-context.ts):

- [ContextMiddleware](backend/src/infrastructure/context/context.middleware.ts) на каждом запросе инициализирует store (IP, User-Agent, request-id).
- [ActorInterceptor](backend/src/infrastructure/context/actor.interceptor.ts) после JWT-guard'а дописывает `actorId` из `req.user`.
- Use-cases зовут `requestContext.get()` — получают `{ actorId, ip, ua, requestId }` без параметров.
- [ContextModule](backend/src/infrastructure/context/context.module.ts) глобален, интерцептор навешен через `APP_INTERCEPTOR`.

### Bull Board (мониторинг очередей)
UI на `http://localhost:3001/api/admin/queues` показывает обе очереди (`avatar-processing`, `report-export`): active/completed/failed jobs, ретраи, логи процессоров, возможность reschedule.

Защита: [mountBullBoard](backend/src/infrastructure/queue/bull-board.setup.ts) — кастомная middleware, которая ДО монтирования роутера Bull Board запускает `JwtAuthGuard.canActivate` и ручную проверку `roles ⊇ { SUPERADMIN | ADM }`. Без валидного токена — 401/403.

### Новые эндпоинты (этап 4)

| Метод | URL                                     | Доступ              | Назначение                               |
|-------|-----------------------------------------|---------------------|------------------------------------------|
| POST  | `/api/documents/init-upload`            | ADM, COM, STU       | инициировать загрузку (presigned PUT)    |
| POST  | `/api/documents/:id/complete`           | ADM, COM, STU       | подтвердить, что файл залит              |
| POST  | `/api/documents/:id/verify`             | ADM, COM            | верифицировать / отклонить               |
| GET   | `/api/students/:id/documents`           | ADM, COM, TEA, STU  | список документов студента               |
| GET   | `/api/documents/:id/download-url`       | ADM, COM, TEA, STU  | presigned GET                            |
| POST  | `/api/payments`                         | ADM, ACC            | выставить платёж                         |
| GET   | `/api/payments`                         | ADM, ACC, ANA       | список с фильтрами                       |
| POST  | `/api/payments/:id/mark-paid`           | ADM, ACC            | отметить оплаченным                      |
| GET   | `/api/students/:id/payments/balance`    | ADM, ACC, STU       | сумма задолженности                      |
| POST  | `/api/reports/exports`                  | ADM, ANA            | поставить экспорт в очередь              |
| GET   | `/api/reports/exports/:id`              | владелец, ADM       | статус + presigned URL на готовый XLSX   |
| `*`   | `/api/admin/queues/*`                   | SUPERADMIN, ADM     | Bull Board UI                            |

### Пример — экспорт отчёта

```bash
# 1) поставить в очередь
curl -X POST http://localhost:3001/api/reports/exports \
  -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" \
  -d '{"kind":"STUDENTS","filters":{"status":"ENROLLED"}}'
# → {"id":"<uuid>","status":"QUEUED"}

# 2) опросить статус
curl http://localhost:3001/api/reports/exports/<uuid> \
  -H "Authorization: Bearer $ACCESS"
# → {"id":"<uuid>","status":"READY","downloadUrl":"https://minio..."}
```

## Этап 5 — Приёмная комиссия (COM) + уведомления

### Заявки абитуриентов
Новая сущность [Application](backend/src/domain/entities/application.entity.ts) со своим жизненным циклом: `SUBMITTED → UNDER_REVIEW → { ACCEPTED → ENROLLED | REJECTED }`. Переходы защищены инвариантами: нельзя отклонить уже зачисленного, причина отказа обязательна, `markEnrolled` разрешён только из `ACCEPTED`.

Подача заявки — **публичный** эндпоинт (без JWT), троттлинг 5 запросов/минуту/IP на `POST /api/applications`, чтобы форма не стала каналом спама. Все остальные операции — только `ADM`/`COM`.

### Массовое зачисление
[BatchEnrollUseCase](backend/src/application/use-cases/applications/batch-enroll.use-case.ts): COM передаёт список ID заявок и целевую группу, получает `{ enrolled: [...], skipped: [{id, reason}, ...] }`. Для каждой `ACCEPTED` создаётся `Student` со статусом `ENROLLED`, заявка переводится в `ENROLLED` с привязкой `studentId`, студенту уходит письмо-поздравление.

Сознательно **без обёртки в транзакцию пакета**: частичный прогресс лучше, чем полный откат из-за единичной заявки (например, битая дата рождения). Каждая обрабатывается атомарно — `create student` + `update application` подряд — и в случае сбоя попадает в `skipped` с причиной.

### Уведомления (email, асинхронно)
Доменный порт [NotificationChannel](backend/src/domain/services/notification-channel.ts) + реализация [SmtpNotificationChannel](backend/src/infrastructure/notifications/smtp-notification-channel.ts) на `nodemailer`. Если `SMTP_HOST` не задан — канал работает как console-логгер (dev-режим, без внешних зависимостей). При старте вызывается `transporter.verify()`, сбой откатывает канал в console-режим с предупреждением в логах.

Продюсер — [NotifyService](backend/src/application/services/notify.service.ts) (очередь `notifications`, 5 попыток, экспоненциальный backoff с 5s). Процессор — [NotificationProcessor](backend/src/infrastructure/queue/processors/notification.processor.ts). HTTP-поток никогда не ждёт SMTP.

**Принципиально некритичные ошибки**: `notify.enqueue()` ловит исключения сам и логирует — если Redis недоступен, это не должно ронять подачу заявки (аналогично `AuditService`).

Интегрировано в: подачу заявки (подтверждение), одобрение/отказ (решение COM), массовое зачисление (поздравление).

### Новые эндпоинты (этап 5)

| Метод | URL                                      | Доступ          | Назначение                               |
|-------|------------------------------------------|-----------------|------------------------------------------|
| POST  | `/api/applications`                      | публично, 5/мин | подать заявку (форма абитуриента)        |
| GET   | `/api/applications`                      | ADM, COM        | список с фильтрами `status/programCode/search` |
| GET   | `/api/applications/:id`                  | ADM, COM        | карточка заявки                          |
| POST  | `/api/applications/:id/review`           | ADM, COM        | `{decision: TAKE\|ACCEPT\|REJECT, reason?}` |
| POST  | `/api/applications/batch-enroll`         | ADM, COM        | `{applicationIds, groupId}` → пакетное зачисление |

### Пример — поток COM

```bash
# 1) Абитуриент подаёт заявку (без авторизации)
curl -X POST http://localhost:3001/api/applications \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Иван","lastName":"Петров","birthDate":"2008-05-14",
       "email":"i.petrov@example.com","programCode":"09.02.07"}'
# → {"id":"<uuid>","status":"SUBMITTED"}
# На email улетает письмо «Ваша заявка принята»

# 2) COM берёт в работу
curl -X POST http://localhost:3001/api/applications/<uuid>/review \
  -H "Authorization: Bearer $COM_ACCESS" -H "Content-Type: application/json" \
  -d '{"decision":"TAKE"}'

# 3) COM одобряет
curl -X POST http://localhost:3001/api/applications/<uuid>/review \
  -H "Authorization: Bearer $COM_ACCESS" -H "Content-Type: application/json" \
  -d '{"decision":"ACCEPT"}'
# Абитуриенту уходит «Заявка одобрена»

# 4) COM зачисляет пакетом в группу
curl -X POST http://localhost:3001/api/applications/batch-enroll \
  -H "Authorization: Bearer $COM_ACCESS" -H "Content-Type: application/json" \
  -d '{"applicationIds":["<uuid>","<uuid2>"],"groupId":"<group-uuid>"}'
# → {"enrolled":["<uuid>"],"skipped":[{"id":"<uuid2>","reason":"статус SUBMITTED, ожидалось ACCEPTED"}]}
```

## Этап 6 — Фронтенд: авторизация и ролевые кабинеты

### Структура
```
frontend/src/
├── app/
│   ├── layout.tsx               # RootLayout + <AuthProvider>
│   ├── page.tsx                 # корень → ролевой home / /login
│   ├── login/page.tsx           # форма входа
│   └── (app)/                   # защищённая группа (<Protected> + <AppShell>)
│       ├── layout.tsx
│       ├── me/page.tsx                  # профиль (все роли)
│       ├── admin/users/page.tsx         # список пользователей (ADM)
│       └── applications/page.tsx        # заявки абитуриентов (ADM/COM)
├── components/
│   ├── protected.tsx            # клиентский охранник (loading / redirect / "нет прав")
│   └── app-shell.tsx            # шапка + ролевая навигация (Framer Motion underline)
└── lib/
    ├── api.ts                   # fetch-клиент с авто-refresh
    ├── auth-context.tsx         # AuthProvider / useAuth
    └── types.ts                 # Role (зеркалит backend), ROLE_LABELS, homePathForRoles
```

### HTTP-клиент и ротация токенов
[lib/api.ts](frontend/src/lib/api.ts) — `apiFetch<T>(path, opts)` с тремя ключевыми свойствами:
1. **Авто-refresh:** на `401` один раз вызывает `/api/auth/refresh`, обновляет пару токенов в `localStorage` и повторяет исходный запрос.
2. **Сериализация параллельных refresh'ей** через `refreshPromise`: 10 одновременных 401-запросов делают один POST, а не десять.
3. **Глобальный `onAuthFailure`:** когда refresh упал — `AuthProvider` выкидывает пользователя на `/login` без прямой зависимости от роутера в модуле HTTP.

Хранение: access/refresh → `localStorage` (MVP). Для production-уровня разумнее перейти на httpOnly-cookie со стороны backend — сейчас `/auth/login` отдаёт пару в JSON.

### Client-side охрана
[components/protected.tsx](frontend/src/components/protected.tsx) работает в 3 состояниях: `loading` → spinner, `!user` → `router.replace('/login')`, `user без роли` → страница «Недостаточно прав». `SUPERADMIN` байпасит любой ролевой фильтр (логика в `hasAnyRole`, зеркалит backend `RolesGuard`).

Серверного middleware на этой задаче нет сознательно: токены живут в `localStorage`, который недоступен в Next middleware; бегать к backend на каждый навигационный переход ради проверки — избыточно.

### Интеграция с backend
- `GET /api/users/me` расширен: возвращает ФИО + активность (подтягивается из БД, а не из JWT-payload — payload намеренно узкий).
- `POST /api/auth/login` тоже расширен: `user` в ответе теперь содержит `firstName`/`lastName`, чтобы сразу после логина можно было отрендерить шапку без дополнительного запроса.
- `GET /api/users` теперь возвращает реальный список (через `UserRepository.list`) с `total`.

### Анимации
`AppShell` использует Framer Motion `layoutId="nav-underline"` для плавной shared-layout-анимации подчёркивания активного пункта меню. Страница логина — минимальный `initial/animate` slide+fade.

### Как протестировать локально
```bash
docker compose up -d postgres redis minio        # инфра
cd backend && npm ci && npm run migration:run && npm run start:dev
# В другой вкладке
cd frontend && npm ci && npm run dev
# Открыть http://localhost:3000 — редирект на /login.
# Войти под SUPERADMIN из .env (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD).
```

## Этап 7 — Фронтенд: студенты, документы, платежи, отчёты

### Структура

```
frontend/src/
├── lib/
│   └── domain.ts                          # типы, лейблы, цвета, formatKopecks(), fmtDate()
├── components/
│   ├── student-documents.tsx              # виджет документов (загрузка, верификация, скачивание)
│   └── student-payments.tsx               # виджет платежей (таблица, баланс, форма выставления)
└── app/(app)/
    ├── students/
    │   ├── page.tsx                        # список студентов с поиском и фильтром
    │   └── [id]/page.tsx                  # карточка студента (документы + платежи)
    ├── payments/page.tsx                  # глобальный реестр платежей (ADM/ACC/ANA)
    └── reports/page.tsx                   # экспорт отчётов (ADM/ACC/ANA)
```

### Доменный слой (`lib/domain.ts`)

Единый модуль, зеркалящий backend-перечисления и типы:

| Сущность        | Статусы                                         | Тип              |
|-----------------|--------------------------------------------------|-------------------|
| Student         | APPLICANT · ENROLLED · ACADEMIC_LEAVE · EXPELLED · GRADUATED | `StudentStatus`   |
| StudentDocument | PENDING · UPLOADED · VERIFIED · REJECTED         | `DocumentStatus`  |
| Payment         | PENDING · PAID · CANCELLED · REFUNDED            | `PaymentStatus`   |
| ReportExport    | QUEUED · RUNNING · READY · FAILED                | `ReportStatus`    |

Каждый тип имеет `*_LABELS` (русские названия) и `*_COLORS` (Tailwind-классы для пилюль статуса).

#### `formatKopecks(kop)` — BigInt-safe форматирование денег

```typescript
// Деньги хранятся как string (BigInt через JSON), поэтому обычные Number() теряют точность
// на суммах >9 007 199 254 740 991 коп. ≈ 90 трлн ₽.
const n = typeof kop === 'bigint' ? kop : BigInt(String(kop));
// → "12 500,00 ₽" (разделитель тысяч — неразрывный пробел, дробная часть — всегда 2 знака)
```

### Список студентов (`students/page.tsx`)

- **Debounced search** (250 мс): ввод в поле поиска не спамит API при быстрой печати.
- **Фильтр по статусу**: выпадающий список → `?status=ENROLLED&search=Иван`.
- **Роли**: ADM, TEA, COM, ANA, ACC.
- Клик по строке → `/students/:id`.

### Карточка студента (`students/[id]/page.tsx`)

Композиция двух виджетов:

```tsx
<StudentDocuments studentId={student.id} />
<StudentPayments  studentId={student.id} />
```

Доступна всем ролям включая STU (студент видит свою карточку).

### Документы (`student-documents.tsx`) — двухфазная загрузка

Ключевой архитектурный паттерн — **браузер загружает файл напрямую в MinIO**, минуя API:

```
Браузер                API                    MinIO
   │                    │                       │
   ├── POST /students/:id/documents ──────►│   │
   │   (kind, originalName, contentType,   │   │
   │    sizeBytes)                         │   │
   │                    │                  │   │
   │◄── {id, uploadUrl} ──────────────────│   │
   │                    │                  │   │
   ├── PUT <uploadUrl> ──────────────────────►│
   │   (body: File, Content-Type)          │   │
   │                    │                  │   │
   │◄── 200 ────────────────────────────────│
   │                    │                  │   │
   ├── POST /documents/:id/complete ──────►│   │
   │                    │                  │   │
   │◄── документ со статусом UPLOADED ────│   │
```

**Зачем**: файлы (паспорта, справки) могут весить десятки МБ; проксирование через API удваивает трафик и держит соединение.

- **Верификация** (ADM, COM): кнопки «Принять» / «Отклонить» (`prompt()` для ввода причины отказа).
- **Скачивание**: `GET /documents/:id/download-url` → `window.open(url)` (presigned GET на 15 мин).

### Платежи (`student-payments.tsx`)

- **Таблица** + **баланс**: два параллельных запроса через `Promise.all` (список + `/payments/students/:id/balance`).
- **Форма выставления** (ADM, ACC): парсинг рублей в копейки без потери точности:
  ```typescript
  // «12500,50» → «1250050» (строка копеек)
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(rubles.trim());
  const kopecks = `${match[1]}${(match[2] ?? '').padEnd(2, '0')}`;
  ```
- **Отметка оплаты** (ADM, ACC): `POST /payments/:id/mark-paid` с необязательным внешним референсом.

### Реестр платежей (`payments/page.tsx`)

Глобальный вид для ACC/ANA: фильтр по статусу, агрегация «К оплате» через `BigInt.reduce`:

```typescript
const totalPending = items
  .filter((p) => p.status === 'PENDING')
  .reduce((acc, p) => acc + BigInt(p.amountKopecks), 0n);
```

### Отчёты (`reports/page.tsx`) — асинхронный экспорт с автополлингом

1. Пользователь выбирает тип (`STUDENTS_ROSTER` | `PAYMENTS_LEDGER`) → нажимает «Поставить в очередь».
2. `POST /api/reports/exports` возвращает `{id, status:'QUEUED'}` — запись добавляется в локальный `tracked[]`.
3. **Автополлинг** (2 сек) стартует при появлении QUEUED/RUNNING записей и **автоостанавливается** когда все перешли в READY/FAILED:
   ```typescript
   const hasPending = tracked.some(r => r.status === 'QUEUED' || r.status === 'RUNNING');
   if (!hasPending) { clearInterval(pollRef.current); return; }
   if (pollRef.current === null) pollRef.current = setInterval(() => tick(), 2000);
   ```
4. Готовый файл → зелёная кнопка «Скачать XLSX» (`<a href={downloadUrl} download>`).

## Этап 8 — Учебные планы, дисциплины, ведомости и оценки

### Доменная модель

```
Discipline ──1:N──► CurriculumEntry ◄──N:1── CurriculumPlan
                          │
                          ▼
                     GradeSheet ──1:N──► Grade
                    (группа + TEA)     (студент)
```

| Сущность         | Описание                                                 | Статусы / Значения                |
|------------------|----------------------------------------------------------|-----------------------------------|
| **Discipline**       | Предмет (код, название, часы)                        | —                                 |
| **CurriculumPlan**   | Учебный план (программа + год набора)                | DRAFT → ACTIVE → ARCHIVED         |
| **CurriculumEntry**  | Позиция плана (дисциплина + семестр + форма контроля)| EXAM · CREDIT · DIFF_CREDIT · COURSEWORK |
| **GradeSheet**       | Ведомость (группа + запись плана + преподаватель)     | OPEN → CLOSED                     |
| **Grade**            | Оценка студента в ведомости                          | 0–5 (0=не зачтено, 5=отлично)    |

### Миграция

`1713400000000-CurriculumGrades.ts` — 5 таблиц с FK-каскадами:
- `disciplines` (UNIQUE code)
- `curriculum_plans` (индексы по program_code+year, status)
- `curriculum_entries` (UNIQUE plan+discipline+semester, FK CASCADE к планам)
- `grade_sheets` (FK RESTRICT к groups, curriculum_entries, users)
- `grades` (UNIQUE sheet+student, FK CASCADE к ведомостям)

### Backend API

| Метод | Путь | Роли | Описание |
|-------|------|------|----------|
| POST  | `/api/curriculum/disciplines`          | ADM         | Создать дисциплину |
| GET   | `/api/curriculum/disciplines`          | ADM,TEA,ANA | Список дисциплин (search) |
| POST  | `/api/curriculum/plans`                | ADM         | Создать учебный план (DRAFT) |
| GET   | `/api/curriculum/plans`                | ADM,TEA,ANA | Список планов (фильтр по статусу/программе/году) |
| GET   | `/api/curriculum/plans/:id`            | ADM,TEA,ANA | Детали плана |
| GET   | `/api/curriculum/plans/:id/entries`    | ADM,TEA,ANA | Записи плана (по семестрам) |
| POST  | `/api/curriculum/plans/:id/entries`    | ADM         | Добавить дисциплину в план |
| DELETE| `/api/curriculum/plans/:pid/entries/:eid` | ADM      | Удалить запись из плана |
| POST  | `/api/curriculum/plans/:id/activate`   | ADM         | DRAFT → ACTIVE |
| POST  | `/api/curriculum/plans/:id/archive`    | ADM         | → ARCHIVED |
| POST  | `/api/grades/sheets`                   | ADM,TEA     | Создать ведомость (автозаполнение студентов группы) |
| GET   | `/api/grades/sheets`                   | ADM,TEA,ANA | Список ведомостей |
| GET   | `/api/grades/sheets/:id`               | ADM,TEA,ANA | Детали ведомости |
| GET   | `/api/grades/sheets/:id/grades`        | ADM,TEA,ANA,STU | Оценки в ведомости |
| POST  | `/api/grades/sheets/:id/submit`        | TEA         | Выставить/изменить оценки (только владелец-TEA) |
| POST  | `/api/grades/sheets/:id/close`         | ADM,TEA     | Закрыть ведомость (все оценки должны быть выставлены) |
| GET   | `/api/grades/students/:studentId`      | ADM,TEA,ANA,STU | Зачётная книжка (все оценки студента) |

### Бизнес-правила

1. **CurriculumPlan FSM**: DRAFT → ACTIVE → ARCHIVED. Архивный нельзя активировать. Добавлять записи можно только в DRAFT и ACTIVE.
2. **GradeSheet автозаполнение**: при создании ведомости автоматически создаются пустые `Grade` для всех ENROLLED студентов группы.
3. **Права на оценки**: только TEA-владелец ведомости может выставлять оценки. ADM или TEA-владелец могут закрыть.
4. **Закрытие**: ведомость нельзя закрыть, если есть студенты без оценки. После закрытия оценки нередактируемы (без ADM).
5. **Аудит**: все операции (создание, изменение оценок, закрытие) логируются через `AuditService` с `oldState/newState`.

### Frontend

```
frontend/src/
├── lib/domain.ts                                    # + типы Discipline, CurriculumPlan, CurriculumEntry,
│                                                    #   GradeSheet, Grade, лейблы, цвета
├── components/
│   └── student-grades.tsx                           # виджет зачётной книжки (средний балл)
└── app/(app)/
    ├── curriculum/
    │   ├── page.tsx                                 # список планов + создание (ADM)
    │   └── [id]/page.tsx                            # детали плана, записи по семестрам, добавление
    └── grades/
        ├── page.tsx                                 # список ведомостей (TEA видит свои, ADM/ANA — все)
        └── [id]/page.tsx                            # ведомость: таблица оценок, inline-редактирование
```

- **Карточка студента** (`students/[id]`) теперь содержит 3 виджета: документы, платежи, зачётная книжка.
- **Inline-редактирование оценок**: TEA кликает «Редактировать» у нужного студента → появляются `<select>` и `<input>` → batch-submit через `POST /sheets/:id/submit`.
- **Навигация**: добавлены «Учебные планы» и «Ведомости» в `AppShell` (ADM, TEA, ANA).

## Что дальше (этап 9+)

- Расписание занятий (привязка к группам, аудиториям, преподавателям).
- Периодические джобы (cron через BullMQ): напоминания о просроченных платежах, чистка orphan-объектов в MinIO, автозакрытие просроченных ведомостей.
- httpOnly-cookie для refresh вместо localStorage (защита от XSS).
- E2E-тесты (Playwright на фронт + supertest + testcontainers на бэк).
- Интеграция с SSO/ЕСИА для публичной подачи заявок.
- Аналитические дашборды (средний балл по группам, успеваемость по дисциплинам).
