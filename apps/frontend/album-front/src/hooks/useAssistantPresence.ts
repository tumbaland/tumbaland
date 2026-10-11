import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollagePerson, personColour } from '../components/collage/CollagePeople';

/** Who saved a batch of changes, as the live stream says. */
export interface ChangeAuthor {
  userId: string;
  name: string;
  /** Set when a connected assistant saved them rather than someone in the editor. */
  assistant?: boolean;
}

/** How long after its last change an assistant stops showing as here. */
export const ASSISTANT_QUIET_MS = 60_000;

/**
 * A connected assistant working on the open collage, shown with the people.
 *
 * An assistant has no tab and no stream, so it never appears in who is here;
 * all there is of it is its saves. Without a face, a photo moving on its own
 * reads as a fault. So it shows from its first change until it has been quiet
 * for a minute.
 */
export const useAssistantPresence = () => {
  const [name, setName] = useState<string | null>(null);
  const quiet = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const noteChange = useCallback((by: ChangeAuthor) => {
    if (!by.assistant) return;
    setName(by.name);
    clearTimeout(quiet.current);
    quiet.current = setTimeout(() => setName(null), ASSISTANT_QUIET_MS);
  }, []);

  useEffect(() => () => clearTimeout(quiet.current), []);

  const person = useMemo<CollagePerson | null>(
    () =>
      name
        ? { userId: `assistant:${name}`, name, picture: null, color: personColour(`assistant:${name}`), selection: null }
        : null,
    [name]
  );

  return { person, noteChange };
};
