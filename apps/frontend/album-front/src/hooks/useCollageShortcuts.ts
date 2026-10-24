import { useEffect } from 'react';
import type { CollageEditor } from './useCollageEditor';

interface ShortcutOptions {
  editor: CollageEditor;
  /** The selection with its geometry, for the arrow keys. */
  selectedItem: { item: { x: number; y: number } } | null | undefined;
  /** An open item dialog takes the keys for itself. */
  editItemId: string | null;
  /** A collage opened to look at, not to change. */
  isViewMode: boolean;
  flush: () => Promise<unknown>;
  removeItem: (id: string) => void;
}

/** Undo, redo, save, delete, escape and the arrow keys, in edit mode and not while typing. */
export const useCollageShortcuts = ({ editor, selectedItem, editItemId, isViewMode, flush, removeItem }: ShortcutOptions) => {
  useEffect(() => {
    if (isViewMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (editItemId || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editor.redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        // Saving happens by itself; the habit still gets an immediate save.
        e.preventDefault();
        void flush();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedId) {
        e.preventDefault();
        removeItem(editor.selectedId);
      } else if (e.key === 'Escape') {
        editor.select(null);
      } else if (e.key.startsWith('Arrow') && editor.selectedId && selectedItem) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        editor.patchItem(editor.selectedId, {
          x: selectedItem.item.x + dx,
          y: selectedItem.item.y + dy
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, selectedItem, editItemId, isViewMode, flush, removeItem]);
};
