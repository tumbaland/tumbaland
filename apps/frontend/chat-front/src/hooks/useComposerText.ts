import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseComposerTextOptions {
  /** A sent message being edited: the box holds its text until saved or cancelled. */
  editing: { id: string; body: string } | null | undefined;
  /** Text to put in the box once per `key`, never while an edit has it. */
  prefill: { text: string; key: number } | null | undefined;
  inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * The text in the message box. An edit takes the box over and gives back what
 * was being typed when it ends; a shared link can be dropped into it.
 */
export function useComposerText({ editing, prefill, inputRef }: UseComposerTextOptions) {
  const [value, setValue] = useState('');
  /** What was being typed before an edit took the box over, given back after. */
  const draft = useRef('');
  const wasEditing = useRef(false);

  const editingId = editing?.id;
  useEffect(() => {
    if (editingId) {
      if (!wasEditing.current) draft.current = value;
      wasEditing.current = true;
      setValue(editing?.body ?? '');
      inputRef.current?.focus();
    } else if (wasEditing.current) {
      wasEditing.current = false;
      setValue(draft.current);
      draft.current = '';
    }
    // Keyed on the id alone: a live update to the message's text must not
    // overwrite what is being typed over it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => {
    if (!prefill?.text || wasEditing.current) return;
    setValue(prefill.text);
    inputRef.current?.focus();
  }, [prefill, inputRef]);

  return { value, setValue };
}
