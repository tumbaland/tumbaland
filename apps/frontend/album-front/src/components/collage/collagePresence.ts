import { CollageViewer } from '../../hooks/useCollageLive';
import { CollagePerson, personColour } from './CollagePeople';

/**
 * The others with the collage open, one entry a person. Your own other tabs
 * are not someone else.
 */
export const othersIn = (viewers: CollageViewer[], session: string): CollagePerson[] => {
  const me = viewers.find((viewer) => viewer.session === session)?.userId;
  const people = new Map<string, CollagePerson>();
  for (const viewer of viewers) {
    if (viewer.session === session || viewer.userId === me) continue;
    const known = people.get(viewer.userId);
    // Two tabs of theirs: show the one with something selected.
    if (known?.selection) continue;
    people.set(viewer.userId, {
      userId: viewer.userId,
      name: viewer.name,
      picture: viewer.picture,
      color: personColour(viewer.userId),
      selection: viewer.selection
    });
  }
  return [...people.values()];
};
