import { useCallback, useMemo, useReducer } from 'react';
import {
  CollageDoc,
  CollagePhotoItem,
  CollageTextItem,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  newItemId
} from '../components/collage/collageDoc';

/**
 * Editor state with undo/redo. Continuous gestures (drag/resize/rotate)
 * update the doc without touching history; the pre-gesture doc is pushed
 * as a single undo step when the gesture ends.
 */

const HISTORY_LIMIT = 100;

interface EditorState {
  doc: CollageDoc | null;
  past: CollageDoc[];
  future: CollageDoc[];
  /** doc as of last save/load; reference equality marks the clean state */
  savedDoc: CollageDoc | null;
  /** snapshot taken when a gesture starts, pushed to past on gesture end */
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
  | { type: 'markSaved' }
  | { type: 'select'; id: string | null };

const pushPast = (past: CollageDoc[], doc: CollageDoc): CollageDoc[] =>
  [...past, doc].slice(-HISTORY_LIMIT);

const reducer = (state: EditorState, action: Action): EditorState => {
  switch (action.type) {
    case 'init':
      return {
        doc: action.doc,
        past: [],
        future: [],
        savedDoc: action.doc,
        gestureBase: null,
        selectedId: null
      };
    case 'commit': {
      if (!state.doc) return state;
      const next = action.updater(state.doc);
      if (next === state.doc && action.select === undefined) return state;
      return {
        ...state,
        doc: next,
        past: next === state.doc ? state.past : pushPast(state.past, state.doc),
        future: next === state.doc ? state.future : [],
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
      if (!state.gestureBase) return state;
      if (state.gestureBase === state.doc) return { ...state, gestureBase: null };
      return {
        ...state,
        gestureBase: null,
        past: pushPast(state.past, state.gestureBase),
        future: []
      };
    }
    case 'undo': {
      if (!state.doc || state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future]
      };
    }
    case 'redo': {
      if (!state.doc || state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        doc: next,
        past: pushPast(state.past, state.doc),
        future: rest
      };
    }
    case 'markSaved':
      return { ...state, savedDoc: state.doc };
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
    default:
      return state;
  }
};

const initialState: EditorState = {
  doc: null,
  past: [],
  future: [],
  savedDoc: null,
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

const moveInArray = <T,>(items: T[], from: number, to: number): T[] => {
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
  const markSaved = useCallback(() => dispatch({ type: 'markSaved' }), []);
  const select = useCallback((id: string | null) => dispatch({ type: 'select', id }), []);

  const commit = useCallback(
    (updater: (d: CollageDoc) => CollageDoc, select?: string | null) =>
      dispatch({ type: 'commit', updater, select }),
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
    isDirty: state.doc !== null && state.doc !== state.savedDoc,
    init,
    undo,
    redo,
    markSaved,
    select,
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
