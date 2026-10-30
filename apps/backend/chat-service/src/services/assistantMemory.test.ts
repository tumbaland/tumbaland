jest.mock('./botService', () => ({ announce: jest.fn() }));
jest.mock('../models/Conversation', () => ({ Conversation: { findById: jest.fn(), updateOne: jest.fn() } }));

import { Conversation } from '../models/Conversation';
import { addNote, removeNote, memoryOn, memoryTools, MEMORY_LIMIT, NOTE_LIMIT } from './assistantMemory';

describe('addNote', () => {
  it('adds a note on its own line, tidied', () => {
    expect(addNote('Tom likes tea', '  - Mia   is vegetarian ')).toEqual({ memory: 'Tom likes tea\nMia is vegetarian', changed: true, message: 'Noted: Mia is vegetarian' });
  });

  it('does not add the same note twice, whatever its case', () => {
    expect(addNote('Mia is vegetarian', 'mia is VEGETARIAN')).toMatchObject({ changed: false, message: 'That is already noted.' });
  });

  it('refuses an empty note and one that is more than a fact', () => {
    expect(addNote('', '   ').changed).toBe(false);
    expect(addNote('', 'x'.repeat(NOTE_LIMIT + 1))).toMatchObject({ changed: false });
  });

  it('says the notes are full instead of cutting one off', () => {
    const full = Array.from({ length: 7 }, (_, i) => `${i}${'a'.repeat(190)}`).join('\n');
    expect(full.length).toBeLessThanOrEqual(MEMORY_LIMIT);
    const result = addNote(full, 'b'.repeat(200));
    expect(result.changed).toBe(false);
    expect(result.message).toMatch(/full/);
  });
});

describe('removeNote', () => {
  const memory = 'Mia is vegetarian\nTom likes tea\nTom likes coffee';

  it('takes away the note that matches, by exact text or a part of it', () => {
    expect(removeNote(memory, 'Mia is vegetarian').memory).toBe('Tom likes tea\nTom likes coffee');
    expect(removeNote(memory, 'vegetarian').memory).toBe('Tom likes tea\nTom likes coffee');
  });

  it('will not guess between several, and lists them', () => {
    const result = removeNote(memory, 'Tom likes');
    expect(result.changed).toBe(false);
    expect(result.message).toContain('"Tom likes tea" or "Tom likes coffee"');
  });

  it('says so when nothing matches', () => {
    expect(removeNote(memory, 'cats')).toMatchObject({ changed: false, message: 'No note matches that.' });
  });
});

describe('memoryTools', () => {
  const conversation = (assistants: Record<string, unknown>) => ({ _id: 'c1', groupId: 'g1', assistants }) as never;
  beforeEach(() => jest.clearAllMocks());

  it('are not handed out when the people have turned noting off, but are on by default', () => {
    expect(memoryOn({ assistants: { memoryOn: false } } as never)).toBe(false);
    expect(memoryOn({ assistants: {} } as never)).toBe(true);
    expect(memoryTools(conversation({ memoryOn: false }))).toEqual([]);
    expect(memoryTools(conversation({})).map((tool) => tool.name)).toEqual(['remember', 'forget']);
  });

  it('save against what is stored now, so an edit made meanwhile is not lost', async () => {
    (Conversation.findById as jest.Mock).mockReturnValue({ select: async () => ({ assistants: { memory: 'Tom likes tea' } }) });
    (Conversation.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    const [remember] = memoryTools(conversation({}));
    expect(await remember!.run({ note: 'Mia is vegetarian' })).toBe('Noted: Mia is vegetarian');
    expect((Conversation.updateOne as jest.Mock).mock.calls[0]![1]).toEqual({ $set: { 'assistants.memory': 'Tom likes tea\nMia is vegetarian' } });
  });

  it('try once more when the text moved, then give up politely', async () => {
    (Conversation.findById as jest.Mock).mockReturnValue({ select: async () => ({ assistants: { memory: '' } }) });
    (Conversation.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 0 });
    const [remember] = memoryTools(conversation({}));
    expect(await remember!.run({ note: 'x is y' })).toMatch(/being edited/);
    expect(Conversation.updateOne).toHaveBeenCalledTimes(2);
  });
});
