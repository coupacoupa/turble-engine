# Project Conventions & Guidelines for Turble Engine

## 1. File Naming & Directory Structure
- All files across the monorepo must strictly use **kebab-case** with descriptive suffix extensions:
  - **Components:** `name.component.tsx`
  - **Pages:** `name.page.tsx`
  - **Services & Evaluators:** `name.service.ts` or `name.evaluator.ts`
  - **Types & Interfaces:** `name.types.ts`
  - **Stores:** `name.store.ts`

## 2. Error Handling & No-Fallback Policy
- All execution paths must handle errors transparently without silent fallbacks:
  - **No Dummy Fallbacks:** Never mask errors, swallow exceptions, or inject silent dummy fallbacks/hardcoded fake values, as this breaks production applications.
  - **Explicit Error Boundaries:** Catch errors explicitly at execution boundaries and report clean diagnostic error states.
  - **User Consultation:** If an ambiguous error condition or unhandled edge case occurs, ask the user directly for guidance on how to handle it rather than inventing silent fallback values.

## 3. Import Path Conventions
- Avoid relative backward imports (`../` or `../../`). Always use the `@/` path alias for internal imports from `src` (e.g. `@/types/matrix.types`, `@/components/...`, `@/lib/...`).

## 4. Monorepo Best Practices
- **Shared utilities, components, and types belong in shared packages** (`packages/*`), not duplicated across apps:
  - **UI primitives & utilities** (e.g. `cn()`, shadcn components, design tokens): `@repo/ui` (`packages/ui`)
  - **Protobuf schemas, generated types & service definitions**: `@repo/proto` (`packages/proto`)
  - **Shared TypeScript config**: `@repo/typescript-config` (`packages/typescript-config`)
  - **Shared ESLint config**: `@repo/eslint-config` (`packages/eslint-config`)
- **App-specific code stays in `apps/*`**: Pages, app-level services, stores, API transport configs, and feature-specific components that are unique to a single app.
- **Never duplicate a shared utility in an app.** If it exists in a shared package, import it from there. If it doesn't exist yet but could be reused, create it in the appropriate shared package first.
- **Workspace dependencies**: Always reference shared packages via `"workspace:*"` in `package.json` dependencies.