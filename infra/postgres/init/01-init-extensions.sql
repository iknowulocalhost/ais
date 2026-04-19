-- Инициализационный скрипт Postgres.
-- Выполняется один раз при создании кластера (пустой volume).
-- Подключает TimescaleDB (для audit_logs) и pgcrypto (gen_random_uuid).

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
