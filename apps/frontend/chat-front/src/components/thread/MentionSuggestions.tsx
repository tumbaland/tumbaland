import Box from '@mui/material/Box';
import { ink, surface } from '@tumbaland/frontend-core';
import type { Bot } from '../../types';
import { BotAvatar } from './BotAvatar';

export interface MentionSuggestionsProps {
  bots: Bot[];
  onPick: (bot: Bot) => void;
}

/** The assistants that match what is being typed after an `@`, to tap instead of typing the rest. */
export function MentionSuggestions({ bots, onPick }: MentionSuggestionsProps) {
  if (bots.length === 0) return null;
  return (
    <Box role="listbox" aria-label="Assistants" sx={{ display: 'flex', gap: 0.75, px: 1.5, pt: 1, flexWrap: 'wrap' }}>
      {bots.map((bot) => (
        <Box
          key={bot.id}
          component="button"
          type="button"
          role="option"
          aria-selected={false}
          // Keeps the focus, and on a phone the keyboard, in the message box.
          onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
          onClick={() => onPick(bot)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            border: `1px solid ${surface.sunken}`,
            bgcolor: 'transparent',
            color: ink.body,
            borderRadius: 4,
            pl: 0.5,
            pr: 1.25,
            py: 0.4,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 14
          }}
        >
          <BotAvatar color={bot.color} size={22} />@{bot.name}
        </Box>
      ))}
    </Box>
  );
}
