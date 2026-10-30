import type { AssistantsView, Bot } from '../../types';

/** A bot as the server describes it, for the tests of everything that draws one. */
export const bot = (overrides: Partial<Bot> = {}): Bot => ({
  id: 'b1',
  name: 'Tumbi',
  personality: 'Cheeky.',
  aboutOwner: 'Likes tea.',
  color: '#7c3aed',
  model: 'claude-sonnet-5-5',
  modelLabel: 'Balanced',
  paused: false,
  ownerId: 'u-tom',
  ownerName: 'Tom',
  mine: true,
  canManage: true,
  ...overrides
});

export const assistantsView = (overrides: Partial<AssistantsView> = {}): AssistantsView => ({
  enabled: true,
  lockedOff: false,
  whoCanAdd: 'everyone',
  aboutUs: '',
  memory: '',
  memoryOn: true,
  isManager: false,
  canAdd: true,
  bots: [],
  presets: [
    { id: 'warm', name: 'Warm and brief', personality: 'Warm and kind.' },
    { id: 'playful', name: 'Playful', personality: 'Playful.' }
  ],
  colors: ['#7c3aed', '#0369a1', '#15803d'],
  models: {
    options: [
      { id: 'claude-haiku-5-5', label: 'Fast', name: 'Haiku', hint: 'Quick and light.' },
      { id: 'claude-sonnet-5-5', label: 'Balanced', name: 'Sonnet', hint: 'Good at several steps.' }
    ],
    default: 'claude-sonnet-5-5'
  },
  allowance: { limit: 5000, used: 2000, percent: 40, capPercent: null, exhausted: false, resetsOn: '2026-11-01' },
  ...overrides
});
