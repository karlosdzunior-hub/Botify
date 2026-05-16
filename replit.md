# Bot Factory

SaaS-платформа для автоматической генерации Telegram-ботов с помощью ИИ. Пользователь описывает идею — ИИ задаёт вопросы, генерирует код и запускает бота.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API сервер (порт 8080)
- `pnpm --filter @workspace/mini-app run dev` — Mini App фронтенд (порт 18801)
- `pnpm run typecheck` — полная проверка типов
- `pnpm run build` — сборка всех пакетов
- `pnpm --filter @workspace/api-spec run codegen` — регенерация хуков и Zod-схем из OpenAPI
- `pnpm --filter @workspace/db run push` — применить изменения схемы БД (dev only)
- Required env: `DATABASE_URL` — строка подключения к Postgres

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite + Tailwind CSS (тёмная тема, ChatGPT-стиль)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (из OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: Groq (Llama 3.3 70B / Qwen 2.5 Coder) + Gemini Flash (fallback)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI контракт (источник истины)
- `lib/db/src/schema/` — схема БД: users, bots, transactions, chat_messages, generations, marketplace
- `artifacts/api-server/src/routes/` — Express роуты по доменам
- `artifacts/api-server/src/lib/ai.ts` — AI роутер (Groq → Gemini fallback)
- `artifacts/api-server/src/lib/auth.ts` — Telegram initData верификация + JWT-like токены
- `artifacts/mini-app/src/` — React Mini App (Telegram WebApp)

## Architecture decisions

- Аутентификация через Telegram WebApp initData (HMAC-SHA256 верификация)
- Токены — HMAC-подписанные строки вида `hash.userId` (без JWT зависимости)
- AI роутинг: Groq бесплатно → Gemini как fallback при ошибке
- Генерация ботов симулируется шагами с реальными задержками (будет заменена реальной генерацией)
- Кредитная система встроена в БД, каждая операция записывается в transactions

## Product

- Чат-интерфейс с ИИ (как ChatGPT) для описания идеи бота
- Управление созданными ботами: старт/стоп/рестарт/логи
- Маркетплейс готовых шаблонов
- Система кредитов и пополнения баланса
- Реферальная программа
- Админ-панель со статистикой

## User preferences

- Язык общения: русский
- Без эмодзи в UI (только иконки Lucide)
- Тёмная тема постоянно, без переключателя

## Gotchas

- После изменения схемы БД: `pnpm --filter @workspace/db run push`
- После изменения openapi.yaml: `pnpm --filter @workspace/api-spec run codegen` + `pnpm run typecheck:libs`
- API сервер работает через esbuild, поэтому TS ошибки не блокируют запуск — всегда проверяй typecheck
- Токены ботов нужно шифровать через Fernet (пока хранятся как plain text — TODO)
- AI ключи (GROQ_API_KEY, GEMINI_API_KEY) нужно добавить в environment secrets

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/index.ts`
