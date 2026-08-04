# Turble Engine

**Turble Engine** is a fast, observable, and deterministic 2D matrix workflow execution engine. It includes a visual matrix editor, a Connect-RPC backend service, and a zero-dependency execution runtime.

---

## 🏗️ Monorepo Architecture

This monorepo is managed with **pnpm workspaces** and **Turborepo**.

```
turble-engine/
├── apps/
│   ├── web/               # Visual 2D Matrix Workflow Builder (Vite + React 19)
│   │                      #   TanStack Router + TanStack Query + connect-query
│   ├── backend/           # Hono + Connect-RPC Backend Service (fetch-runtime portable)
│   └── docs/              # Next.js 16 Documentation Portal
├── packages/
│   ├── engine/            # Core Engine: TEL parser, Compiler, Interpreter & Replay
│   ├── proto/             # Protobuf schemas & Connect-RPC generated types
│   ├── db/                # Drizzle ORM schema + Neon Postgres client (@repo/db)
│   ├── ui/                # Shared React UI components
│   ├── eslint-config/     # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
└── lefthook.yml           # Automated Pre-Commit & Pre-Push Git Hooks
```

### Stack at a glance

| Layer    | Choice                                                                                                                                                          |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | [Hono](https://hono.dev) + [Connect-RPC](https://connectrpc.com) (custom fetch adapter — runs on Node today, AWS Lambda later)                                  |
| Frontend | React 19, [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query) + `@connectrpc/connect-query`, Tailwind v4              |
| Database | [Neon](https://neon.com) serverless Postgres + [Drizzle ORM](https://orm.drizzle.team)                                                                          |
| Auth     | [Neon Auth](https://neon.com/docs/auth/overview) (Managed Better Auth) — hosted sign-in/sign-up, users stored in our own Postgres, RPCs verified via JWT + JWKS |

---

## 🚀 Quick Start

### Installation

```bash
pnpm install
```

This automatically binds **Lefthook** Git hooks (`prepare` script).

### Environment setup

Both apps need environment files before first run (templates provided):

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

| Variable             | Where               | Source                                        |
| :------------------- | :------------------ | :-------------------------------------------- |
| `DATABASE_URL`       | `apps/backend/.env` | Neon Console → Project → Connect              |
| `NEON_AUTH_URL`      | `apps/backend/.env` | Neon Console → Project → Auth (Auth Base URL) |
| `VITE_NEON_AUTH_URL` | `apps/web/.env`     | Same value as `NEON_AUTH_URL`                 |
| `VITE_API_URL`       | `apps/web/.env`     | Backend URL (default `http://localhost:8080`) |

The backend fails fast at startup if `NEON_AUTH_URL` is missing.

### Development

Run all applications and services in parallel:

```bash
pnpm dev
```

Or target specific apps:

```bash
pnpm dev:web      # Start web workflow builder (http://localhost:3000)
pnpm dev:backend  # Start Hono Connect-RPC server (http://localhost:8080)
pnpm dev:app      # Start web + backend together
```

---

## 🔐 Authentication

Auth is **Neon Auth (Managed Better Auth)** — sign-in/sign-up/password-reset pages are served by prebuilt components at `/auth/*` in the web app, backed by Neon's hosted endpoints. Auth data lives in the `neon_auth` schema of our own Postgres; users are visible in the Neon Console → Auth tab.

- **Web**: routes are session-guarded (`beforeLoad` redirect to `/auth/sign-in`); every RPC carries the session JWT as a `Authorization: Bearer` header. Google social login is enabled (shared dev credentials — configure your own for production).
- **Backend**: a Connect interceptor verifies the JWT against Neon's JWKS (cached, local verification) and exposes the user to handlers via typed context (`ctx.values.get(kUser)`). Unauthenticated RPCs are rejected.

---

## 🛠️ CLI Commands

| Command            | Description                                        |
| :----------------- | :------------------------------------------------- |
| `pnpm build`       | Build all packages and applications                |
| `pnpm test`        | Run unit tests across all packages (`vitest`)      |
| `pnpm check-types` | Run TypeScript type checks across all packages     |
| `pnpm lint`        | Run ESLint across all packages                     |
| `pnpm format`      | Auto-format code and organize imports (`prettier`) |

Database commands (run against `@repo/db`):

| Command                              | Description                       |
| :----------------------------------- | :-------------------------------- |
| `pnpm --filter @repo/db db:push`     | Push schema changes to Neon (dev) |
| `pnpm --filter @repo/db db:generate` | Generate SQL migrations           |
| `pnpm --filter @repo/db db:migrate`  | Apply migrations                  |
| `pnpm --filter @repo/db db:studio`   | Open Drizzle Studio (DB browser)  |

---

## 🔒 Automated Pre-Commit Workflow (Lefthook)

This repository uses **Lefthook** to automate code quality gates before commits:

- **Pre-commit**:
  - Automatically formats code and cleans/organizes imports on staged files (`prettier-plugin-organize-imports`).
  - Runs type checking (`check-types`) and linting (`lint`).
- **Pre-push**:
  - Runs unit tests (`pnpm test`) before pushing to remote branches.

---

## ☁️ Cloud Direction

The stack is deliberately fetch-runtime portable: the Hono backend (auth verification included) targets **AWS Lambda** (Function URL) with the web app on **S3 + CloudFront** and docs on **Vercel**, deployed via **SST** — designed to fit inside always-free tiers. Deployment scaffolding is not yet in the repo.

---

## 🦀 Future Rust Engine Architecture

The core `@repo/engine` interface (`compileMatrix`, `executeMatrixSync`, `ExecutionLog`) is explicitly designed as a deterministic event-sourced contract. This contract enables seamless replacement or acceleration via a **Rust WebAssembly / FFI engine** without altering frontend or Connect-RPC API layers.
