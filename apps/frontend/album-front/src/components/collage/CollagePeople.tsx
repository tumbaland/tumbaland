import React from 'react';
import { Avatar, AvatarGroup, Box, Tooltip } from '@mui/material';
import { CollageDoc } from '@tumbaland/collage-core';

/** Someone else with the collage open, as the editor shows them. */
export interface CollagePerson {
  userId: string;
  name: string;
  picture: string | null;
  color: string;
  /** The item they have selected, if any. */
  selection: string | null;
}

// Bright enough to read on a pale or a dark canvas, and none of them the
// editor's own selection indigo.
const PERSON_COLOURS = ['#ec4899', '#f97316', '#10b981', '#0ea5e9', '#a855f7', '#eab308'];

/** Someone else's item mid-gesture, as the stage draws it. */
export interface StageMotion {
  userId: string;
  item: { id: string; x: number; y: number; width: number; height: number; rotation?: number };
}

/**
 * Eases an item between the positions someone reports while moving it. As
 * long as the gap between reports, so each move just finishes as the next
 * one arrives.
 */
export const FOLLOW_TRANSITION =
  'left 100ms linear, top 100ms linear, width 100ms linear, height 100ms linear, transform 100ms linear';

/** The same colour for the same person every time, on every screen. */
export const personColour = (userId: string): string => {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PERSON_COLOURS[hash % PERSON_COLOURS.length]!;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

/** Faces of the people editing alongside you, for the toolbar. */
export const CollagePeopleFaces: React.FC<{ people: CollagePerson[] }> = ({ people }) => {
  if (people.length === 0) return null;
  const names = people.map((person) => person.name);
  const label =
    names.length === 1 ? `${names[0]} is here` : `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are here`;
  return (
    <Tooltip title={label}>
      <AvatarGroup
        max={4}
        aria-label={label}
        sx={{ mx: 0.5, '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.75rem' } }}
      >
        {people.map((person) => (
          <Avatar
            key={person.userId}
            alt={person.name}
            src={person.picture ?? undefined}
            sx={{ bgcolor: person.color, border: `2px solid ${person.color} !important` }}
          >
            {initials(person.name)}
          </Avatar>
        ))}
      </AvatarGroup>
    </Tooltip>
  );
};

/**
 * An outline in each person's colour around what they have selected, with
 * their name on it. Drawn in canvas space, so it follows the item as it moves.
 */
export const RemoteSelections: React.FC<{
  doc: CollageDoc;
  people: CollagePerson[];
  /** What each person is moving right now, if anything: named on the outline. */
  motions?: StageMotion[];
  scale: number;
}> = ({ doc, people, motions = [], scale }) => (
  <>
    {people.map((person) => {
      const moving = motions.find((motion) => motion.userId === person.userId);
      const target = moving?.item.id ?? person.selection;
      const item = doc.photos.find((photo) => photo.id === target) ?? doc.texts.find((text) => text.id === target);
      if (!item) return null;
      const rotation = 'rotation' in item ? item.rotation : 0;
      return (
        <Box
          key={person.userId}
          data-testid={`remote-selection-${person.userId}`}
          aria-hidden
          sx={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
            transform: `rotate(${rotation || 0}deg)`,
            outline: `${2 / scale}px solid ${person.color}`,
            outlineOffset: `${4 / scale}px`,
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 25,
            transition: moving ? FOLLOW_TRANSITION : undefined
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: -4 / scale,
              bottom: '100%',
              mb: `${6 / scale}px`,
              px: `${6 / scale}px`,
              py: `${2 / scale}px`,
              borderRadius: `${4 / scale}px`,
              bgcolor: person.color,
              color: '#fff',
              fontSize: 12 / scale,
              fontWeight: 600,
              lineHeight: 1.3,
              whiteSpace: 'nowrap'
            }}
          >
            {moving ? `${person.name} is moving this` : person.name}
          </Box>
        </Box>
      );
    })}
  </>
);
