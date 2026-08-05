import { useEffect } from "react";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";

/**
 * Global Keyboard listener for Ctrl+C, Ctrl+X, Ctrl+V, Escape, Arrow Keys, Enter.
 * Reads store state via Zustand `getState()` so listener attaches ONCE on mount with ZERO prop dependencies.
 */
export const useMatrixKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const store = useMatrixEditorStore.getState();

      if (e.key === "Escape") {
        if (store.activeModal) {
          store.closeModal();
          return;
        }

        if (store.selectedRowId || store.selectedColId || store.copiedCellKey) {
          e.preventDefault();
          store.deselectAll();
          return;
        }
      }

      if (isInput || store.activeModal) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        store.copyCell();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        store.cutCell();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        store.pasteCell();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        store.navigateCell("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        store.navigateCell("down");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        store.navigateCell("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        store.navigateCell("right");
      } else if (e.key === "Enter") {
        if (store.selectedRowId && store.selectedColId) {
          e.preventDefault();
          store.openModal("cellEditor");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
