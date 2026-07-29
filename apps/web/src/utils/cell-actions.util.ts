/**
 * Cell → action-list normalization lives in @repo/engine so the editor UI and
 * the execution engine can never disagree about what a cell does. Re-exported
 * here so existing `@/utils/cell-actions.util` imports keep working.
 */
export { getCellActions } from '@repo/engine';
