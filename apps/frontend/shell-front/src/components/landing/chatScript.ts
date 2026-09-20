/**
 * The exchange the hero plays.
 *
 * It is the whole pitch, so it is a session rather than a list of example
 * prompts: say what happened, then ask about the money, then go looking for
 * the photos. Three modules in three turns, which is the claim the page makes.
 *
 * Every tool named here is one the MCP server actually ships, under the name
 * it actually has. The numbers are illustrative: they are shaped like a real
 * year of restaurant spending, but nobody's real spending belongs on a public
 * page.
 */

/** What the answer arrives with. Each one is drawn by ChatPlayback. */
export type ChatCard = 'entry' | 'spending' | 'photos';

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
  { from: 'you', text: 'how much did we spend on restaurants this year?' },
  {
    from: 'assistant',
    text: '1,930 so far, against 1,871 last year. Slightly up, and steady month to month.',
    tools: ['get_spending', 'get_spending_trends'],
    card: 'spending'
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

/** Monthly restaurant spending, in order from January. Illustrative. */
export const SPENDING_BY_MONTH = [148, 132, 166, 154, 205, 181, 243, 226, 174, 158, 162, 181];

export const SPENDING_CARD = {
  title: 'Restaurants, by month',
  /** Drawn as a dashed line across the bars. */
  average: 176,
  averageLabel: 'avg 176'
};
