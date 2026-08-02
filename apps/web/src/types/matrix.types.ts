/**
 * Matrix schema types now live in @repo/engine (the execution engine is the
 * source of truth for execution semantics). This module re-exports them so
 * existing `@/types/matrix.types` imports keep working.
 */
export * from "@repo/engine/schema";
