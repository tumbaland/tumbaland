import { useCallback, useMemo, useReducer } from 'react';
import {
  CollageDoc,
  CollagePhotoItem,
  CollageTextItem,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  newItemId
} from '../components/collage/collageDoc';
import { applyDocChange, diffDocs, DocChange, rebase } from '../components/collage/collageChanges';

/**
 * Editor state with undo/redo. Continuous gestures (drag/resize/rotate)
 * update the doc without touching history; what the whole gesture changed is
 * recorded as a single undo step when it ends.
 *
 * History holds changes, not copies of the collage: undo reverses what this
 * editor did to the items it touched and leaves everything else as it is now.
 */

const HISTORY_LIMIT = 100;

interface EditorState {
  doc: CollageDoc | null;
  past: DocChange[];
  future: DocChange[];
  /** snapshot taken when a gesture starts, diffed against the doc when it ends */
  gestureBase: CollageDoc | null;
  selectedId: string | null;
}

type ItemPatch = Partial<Omit<CollagePhotoItem, 'id'>> & Partial<Omit<CollageTextItem, 'id'>>;

type Action =
  | { type: 'init'; doc: CollageDoc }
  | { type: 'commit'; updater: (doc: CollageDoc) => CollageDoc; select?: string | null }
  | { type: 'gestureStart' }
  | { type: 'gestureMove'; updater: (doc: CollageDoc) => CollageDoc }
  | { type: 'gestureEnd' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; id: string | null }
  | { type: 'rebase'; base: CollageDoc; incoming: CollageDoc };

const pushPast = (past: DocChange[], change: DocChange): DocChange[] => [...past, change].slice(-HISTORY_LIMIT);

/** The selection, unless the item it names is gone. */
const stillThere = (doc: CollageDoc, id: string | null): string | null =>
  id && (doc.photos.some((p) => p.id === id) || doc.texts.some((t) => t.id === id)) ? id : null;

const reducer = (state: EditorState, action: Action): EditorState => {
  switch (action.type) {
    case 'init':
      return {
        doc: action.doc,
        past: [],
        future: [],
        gestureBase: null,
        selectedId: null
      };
    case 'commit': {
      if (!state.doc) return state;
      const next = action.updater(state.doc);
      const change = diffDocs(state.doc, next);
      if (!change && action.select === undefined) return state;
      return {
        ...state,
        doc: change ? next : state.doc,
        past: change ? pushPast(state.past, change) : state.past,
        future: change ? [] : state.future,
        selectedId: action.select !== undefined ? action.select : state.selectedId
      };
    }
    case 'gestureStart':
      if (!state.doc || state.gestureBase) return state;
      return { ...state, gestureBase: state.doc };
    case 'gestureMove': {
      if (!state.doc || !state.gestureBase) return state;
      return { ...state, doc: action.updater(state.doc) };
    }
    case 'gestureEnd': {
      if (!state.gestureBase || !state.doc) return state;
      const change = diffDocs(state.gestureBase, state.doc);
      if (!change) return { ...state, gestureBase: null };
      return {
        ...state,
        gestureBase: null,
        past: pushPast(state.past, change),
        future: []
      };
    }
    case 'undo': {
      if (!state.doc || state.past.length === 0) return state;
      const change = state.past[state.past.length - 1];
      const doc = applyDocChange(state.doc, change, 'back');
      return {
        ...state,
        doc,
        past: state.past.slice(0, -1),
        future: [change, ...state.future],
        selectedId: stillThere(doc, state.selectedId)
      };
    }
    case 'redo': {
      if (!state.doc || state.future.length === 0) return state;
      const [change, ...rest] = state.future;
      const doc = applyDocChange(state.doc, change, 'forward');
      return {
        ...state,
        doc,
        past: pushPast(state.past, change),
        future: rest,
        selectedId: stillThere(doc, state.selectedId)
      };
    }
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
    case 'rebase': {
      // Someone else's saved changes, under this editor's own unsaved ones.
      // Not an undo step: undo is for what you did.
      if (!state.doc) return state;
      const doc = rebase(state.doc, action.base, action.incoming);
      return {
        ...state,
        doc,
        gestureBase: state.gestureBase ? rebase(state.gestureBase, action.base, action.incoming) : null,
        selectedId: stillThere(doc, state.selectedId)
      };
    }
    default:
      return state;
  }
};

const initialState: EditorState = {
  doc: null,
  past: [],
  future: [],
  gestureBase: null,
  selectedId: null
};

const patchItems = <T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] => {
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return items;
  const next = items.slice();
  next[idx] = { ...next[idx], ...patch };
  return next;
};

const moveInArray = <T>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const useCollageEditor = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { doc, selectedId } = state;

  const init = useCallback((newDoc: CollageDoc) => dispatch({ type: 'init', doc: newDoc }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const select = useCallback((id: string | null) => dispatch({ type: 'select', id }), []);
  /** Brings in a newer saved copy (`incoming`, built from `base`), keeping local edits on top. */
  const applyIncoming = useCallback(
    (base: CollageDoc, incoming: CollageDoc) => dispatch({ type: 'rebase', base, incoming }),
    []
  );

  const commit = useCallback(
    (updater: (d: CollageDoc) => CollageDoc, select?: string | null) => dispatch({ type: 'commit', updater, select }),
    []
  );

  const beginGesture = useCallback(() => dispatch({ type: 'gestureStart' }), []);
  const endGesture = useCallback(() => dispatch({ type: 'gestureEnd' }), []);
  const gesturePatchItem = useCallback((id: string, patch: ItemPatch) => {
    dispatch({
      type: 'gestureMove',
      updater: (d) => ({
        ...d,
        photos: patchItems(d.photos, id, patch as Partial<CollagePhotoItem>),
        texts: patchItems(d.texts, id, patch as Partial<CollageTextItem>)
      })
    });
  }, []);

  const patchItem = useCallback(
    (id: string, patch: ItemPatch) =>
      commit((d) => ({
        ...d,
        photos: patchItems(d.photos, id, patch as Partial<CollagePhotoItem>),
        texts: patchItems(d.texts, id, patch as Partial<CollageTextItem>)
      })),
    [commit]
  );

  const patchDoc = useCallback(
    (patch: Partial<Omit<CollageDoc, 'photos' | 'texts'>>) => commit((d) => ({ ...d, ...patch })),
    [commit]
  );

  const addPhoto = useCallback(
    (photo: Omit<CollagePhotoItem, 'id'>) => {
      const id = newItemId();
      commit((d) => ({ ...d, photos: [...d.photos, { ...photo, id }] }), id);
      return id;
    },
    [commit]
  );

  const addText = useCallback(
    (text?: Partial<Omit<CollageTextItem, 'id'>>) => {
      const id = newItemId();
      commit(
        (d) => ({
          ...d,
          texts: [
            ...d.texts,
            {
              id,
              text: 'Double-click to edit',
              x: d.canvas.width / 2 - 120,
              y: d.canvas.height / 2 - 30,
              width: 240,
              height: 60,
              fontSize: DEFAULT_TEXT_SIZE,
              color: DEFAULT_TEXT_COLOR,
              ...text
            }
          ]
        }),
        id
      );
      return id;
    },
    [commit]
  );

  const removeItem = useCallback(
    (id: string) =>
      commit(
        (d) => ({
          ...d,
          photos: d.photos.filter((p) => p.id !== id),
          texts: d.texts.filter((t) => t.id !== id)
        }),
        null
      ),
    [commit]
  );

  /** direction: +1 brings forward, -1 sends backward (within its own layer list) */
  const reorderItem = useCallback(
    (id: string, direction: 1 | -1) =>
      commit((d) => {
        const pIdx = d.photos.findIndex((p) => p.id === id);
        if (pIdx !== -1) return { ...d, photos: moveInArray(d.photos, pIdx, pIdx + direction) };
        const tIdx = d.texts.findIndex((t) => t.id === id);
        if (tIdx !== -1) return { ...d, texts: moveInArray(d.texts, tIdx, tIdx + direction) };
        return d;
      }),
    [commit]
  );

  const selectedItem = useMemo(() => {
    if (!doc || !selectedId) return null;
    const photo = doc.photos.find((p) => p.id === selectedId);
    if (photo) return { kind: 'photo' as const, item: photo };
    const text = doc.texts.find((t) => t.id === selectedId);
    if (text) return { kind: 'text' as const, item: text };
    return null;
  }, [doc, selectedId]);

  return {
    doc,
    selectedId,
    selectedItem,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    /** True while a drag, resize or rotate is under way. Autosave waits for it to end. */
    gestureActive: state.gestureBase !== null,
    init,
    undo,
    redo,
    select,
    applyIncoming,
    patchDoc,
    patchItem,
    addPhoto,
    addText,
    removeItem,
    reorderItem,
    beginGesture,
    gesturePatchItem,
    endGesture
  };
};

export type CollageEditor = ReturnType<typeof useCollageEditor>;
