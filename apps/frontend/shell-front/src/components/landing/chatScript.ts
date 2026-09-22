/**
 * The exchange the hero plays.
 *
 * It is the whole pitch, so it is a session rather than a list of example
 * prompts: say what happened, ask what you have been doing together, then go
 * looking for the photos. All three are about the two of you, which is what
 * the app is for.
 *
 * Every tool named here is one the MCP server actually ships, under the name
 * it actually has. The numbers are illustrative: nobody's real evenings belong
 * on a public page.
 */

/** What the answer arrives with. Each one is drawn by ChatPlayback. */
export type ChatCard = 'entry' | 'stats' | 'photos';

export interface ChatTurn {
  from: 'you' | 'assistant';
  text: string;
  /** Tools it calls first, played as calls that run and complete. */
  tools?: string[];
  card?: ChatCard;
}

export const CHAT: ChatTurn[] = [
  { from: 'you', text: 'we went to Sushi House on Friday, and watched two Futurama episodes' },
  {
    from: 'assistant',
    text: 'Logged for Friday 4 September. Dining at Sushi House, and Movies.',
    tools: ['list_activity_types', 'log_day'],
    card: 'entry'
  },
  { from: 'you', text: 'what have we been doing most lately?' },
  {
    from: 'assistant',
    text: 'Eating out, mostly: 9 dinners this month, up from 5. Walks have tailed off since the rain.',
    tools: ['get_stats'],
    card: 'stats'
  },
  { from: 'you', text: 'what did we photograph this day last year?' },
  {
    from: 'assistant',
    text: 'Nine photos from Nice, a year ago today.',
    tools: ['get_photo_memories'],
    card: 'photos'
  }
];

/** The logged evening, as the journal shows it back. */
export const ENTRY_CARD = {
  date: 'Friday 4 September',
  rows: [
    { title: 'Sushi House', meta: 'Dining' },
    { title: 'Futurama, two episodes', meta: 'Movies' }
  ]
};

/**
 * What get_stats answers with: each kind of activity, how often, and whether
 * it is picking up or fading against the month before. Illustrative.
 */
export const STATS_CARD = {
  title: 'This month, together',
  rows: [
    { name: 'Dining', count: 9, trend: 'up' as const },
    { name: 'Movies', count: 6, trend: 'steady' as const },
    { name: 'Walks', count: 3, trend: 'down' as const }
  ]
};
