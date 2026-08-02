# Turble Engine

**Turble Engine** is a fast, observable, and deterministic 2D matrix workflow execution engine. It includes a visual matrix editor, a Connect-RPC backend service, and a zero-dependency execution runtime.

---

## 🏗️ Monorepo Architecture

This monorepo is managed with **pnpm workspaces** and **Turborepo**.

```
turble-engine/
├── apps/
│   ├── web/               # Visual 2D Matrix Workflow Builder (Vite + React 19)
│   ├── backend/           # Connect-RPC Node.js Backend Service
│   └── docs/              # Next.js 16 Documentation Portal
├── packages/
│   ├── engine/            # Core Engine: TEL parser, Compiler, Interpreter & Replay
│   ├── proto/             # Protobuf schemas & Connect-RPC generated types
│   ├── ui/                # Shared React UI components
│   ├── eslint-config/     # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
└── lefthook.yml           # Automated Pre-Commit & Pre-Push Git Hooks
```

---

## 🚀 Quick Start

### Installation

```bash
pnpm install
```

This automatically binds **Lefthook** Git hooks (`prepare` script).

### Development

Run all applications and services in parallel:

```bash
pnpm dev
```

Or target specific apps:

```bash
pnpm dev:web      # Start web workflow builder (http://localhost:3000)
pnpm dev:backend  # Start Connect-RPC server (http://localhost:8080)
pnpm dev:app      # Start web + backend together
```

---

## 🛠️ CLI Commands

| Command            | Description                                        |
| :----------------- | :------------------------------------------------- |
| `pnpm build`       | Build all packages and applications                |
| `pnpm test`        | Run unit tests across all packages (`vitest`)      |
| `pnpm check-types` | Run TypeScript type checks across all packages     |
| `pnpm lint`        | Run ESLint across all packages                     |
| `pnpm format`      | Auto-format code and organize imports (`prettier`) |

---

## 🔒 Automated Pre-Commit Workflow (Lefthook)

This repository uses **Lefthook** to automate code quality gates before commits:

- **Pre-commit**:
  - Automatically formats code and cleans/organizes imports on staged files (`prettier-plugin-organize-imports`).
  - Runs type checking (`check-types`) and linting (`lint`).
- **Pre-push**:
  - Runs unit tests (`pnpm test`) before pushing to remote branches.

---

## 🦀 Future Rust Engine Architecture

The core `@repo/engine` interface (`compileMatrix`, `executeMatrixSync`, `ExecutionLog`) is explicitly designed as a deterministic event-sourced contract. This contract enables seamless replacement or acceleration via a **Rust WebAssembly / FFI engine** without altering frontend or Connect-RPC API layers.
