import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import type { Reaction } from '../../types';

export interface ReactionRowProps {
  reactions: Reaction[];
  mine: boolean;
  onToggle: (emoji: string) => void;
}

/** Reactions grouped by emoji, with the names of whoever left them. */
export function ReactionRow({ reactions, mine, onToggle }: ReactionRowProps) {
  const grouped = new Map<string, string[]>();
  for (const reaction of reactions) {
    grouped.set(reaction.emoji, [...(grouped.get(reaction.emoji) ?? []), reaction.name || 'Someone']);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        mt: 0.5,
        mx: 1,
        justifyContent: mine ? 'flex-end' : 'flex-start'
      }}
    >
      {[...grouped.entries()].map(([emoji, names]) => (
        <Tooltip key={emoji} title={names.join(', ')}>
          <Box
            component="button"
            type="button"
            onClick={() => onToggle(emoji)}
            aria-label={`${emoji}, ${names.join(', ')}`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 999,
              border: `1px solid ${surface.sunken}`,
              bgcolor: surface.paper,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 12,
              lineHeight: 1.6,
              color: ink.body,
              '&:hover': { borderColor: brand.pinkInk }
            }}
          >
            <span aria-hidden>{emoji}</span>
            {names.length > 1 && <span>{names.length}</span>}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
