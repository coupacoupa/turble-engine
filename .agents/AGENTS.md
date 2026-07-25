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