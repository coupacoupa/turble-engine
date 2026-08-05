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
- **Never duplicate a shared utility in an app.** If it exists in a shared package, import it from there. If it doesn't exist yet but could be reused, create it in the appropriate shared package first. The same applies _within_ an app: a helper needed by two components (e.g. `getExcelColumnLetter`) lives once in `src/utils/`, never re-implemented inline.
- **Workspace dependencies**: Always reference shared packages via `"workspace:*"` in `package.json` dependencies.

## 5. State Ownership (Zustand)

- **Stores own truth; components own only transient UI state.** Domain data (the matrix, selection, panels/modals) lives in a store. Component-local `useState` is reserved for state nobody else could ever need (an input's in-flight text, drag-hover flags, resize widths).
- **Store IDs, derive objects.** Never store an entity object _and_ its ID, or copies of entities that can go stale. Store the ID; derive the object with an exported selector (see `selectSelectedRow` in `matrix-editor.store.ts`).
- **Derived data is computed where it renders, not persisted in a store or synced via `useEffect`.** If a value can be computed from existing state, compute it in a selector or `useMemo`. Syncing state-from-state with an effect is a defect (`rerender-derived-state-no-effect`).
- **Shared derivations become exported selectors.** If two components repeat the same lookup (e.g. `actions.find((a) => a.id === activeActionId) || actions[0]`), export one selector from the store. Copy-pasted fallback logic diverges.
- **Components call store actions directly.** Do NOT thread store actions through optional callback props (`onHoverInput?.(...)`). Optional callbacks silently no-op when a parent forgets to pass them — that is how dead features ship. Props are for data and for genuine page-level concerns (react-query mutations, navigation); behavior that lives in a store is imported from the store.
- **Draft/commit for modal editors.** Modal editing uses a scratch store (`cell-editor.store.ts` pattern): initialize from the entity on open — including _every_ field the editor displays — and commit _every_ field back on save. An editor field that is initialized but never committed (or vice versa) is data loss.

## 6. Wiring Completeness — no half-built features

- **Every piece of state must have both a writer and a reader.** Before finishing a change, verify: every store field is read somewhere, every store action is called somewhere, every component prop is passed by at least one caller, every `useState` flag actually gates rendered output. A `setX` with no consumer of `x` (or an `isOpen` with no modal) is an unfinished feature — finish it or delete it.
- **Prefer required over optional.** Optional props and optional chaining on callbacks hide missing wiring at the type level. Make props required unless absence is a real, intended mode.
- Periodically run an unused-export sweep (`knip`/`ts-prune`) over `apps/web/src` — dead exports are wiring gaps.

## 7. React Rendering Rules (project-specific, on top of vercel-react-best-practices)

- **Grid/list cells must be memoized components.** Any component rendering O(rows × cols) children extracts the cell/header into `React.memo` children with primitive or reference-stable props. Top-level transient state (rename text, drag-over ids, resize sizes) must not re-render every cell per keystroke/mousemove — keep it in the smallest component that needs it, or in a ref (`rerender-use-ref-transient-values`).
- **Stable React keys are identity, never position.** Keys must not embed coordinates, indexes-of-sortable-lists, or anything that changes on scroll/drag — that forces unmount/remount and replays entrance animations.
- **Modals and docked panels are lazy candidates.** Anything not needed for first paint (`CellEditorModal`, inspector panels) should be `React.lazy`-loaded.
- **Hooks before early returns, with a comment** — an `undefined` matrix mid-session must never change hook call order (see existing comments in `matrix-sheet.component.tsx`).
- **Interactive elements are `<button>`/`<a>`, not `<div onClick>`** — keyboard and focus semantics are required.
- **Z-index uses the semantic tokens** (`z-sticky`, `z-modal`, `z-flow-overlay`, ...) — never arbitrary values like `z-[99999]`. Add a token if a new layer is needed.
- **Component size guideline:** a component mixing 3+ concerns (rendering + drag + resize + editing...) or approaching ~300 lines gets split by responsibility. Follow the `cell-editor/` tree as the reference structure.

## 8. Persistence Hygiene

- **Mutations clean up their dependents.** Deleting a row/column must also delete its orphaned `cells` entries; renames/reorders must not leave dangling references. Anything autosaved must be internally consistent.
- **User-entered JSON is validated at the edit site**, with an inline error shown and save blocked while invalid — never parsed with a silent `catch` that drops the user's input (see §2 No-Fallback Policy).
