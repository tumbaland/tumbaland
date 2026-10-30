import { describe, expect, it } from 'vite-plus/test';
import { insertMention, mentionSuggestions } from './mentionSuggest';

const bots = [
  { name: 'Tumbi', paused: false },
  { name: 'Tuula', paused: false },
  { name: 'Bubu', paused: false },
  { name: 'Tomm', paused: true }
];

describe('mentionSuggestions', () => {
  it('offers every assistant for a bare @', () => {
    expect(mentionSuggestions('@', bots).map((bot) => bot.name)).toEqual(['Tumbi', 'Tuula', 'Bubu']);
  });

  it('narrows by what has been typed, ignoring case', () => {
    expect(mentionSuggestions('hello @tu', bots).map((bot) => bot.name)).toEqual(['Tumbi', 'Tuula']);
    expect(mentionSuggestions('@TUM', bots).map((bot) => bot.name)).toEqual(['Tumbi']);
  });

  it('never offers one that is paused', () => {
    expect(mentionSuggestions('@To', bots)).toEqual([]);
  });

  it('offers nothing when no @ is being typed', () => {
    expect(mentionSuggestions('hello', bots)).toEqual([]);
    expect(mentionSuggestions('', bots)).toEqual([]);
    expect(mentionSuggestions('mail me@tu', bots)).toEqual([]);
  });

  it('closes once the mention is finished, or the text moves on', () => {
    expect(mentionSuggestions('@Tumbi where', bots)).toEqual([]);
    expect(mentionSuggestions('@Tumbi ', bots)).toEqual([]);
  });

  it('offers at most four', () => {
    const many = ['A1', 'A2', 'A3', 'A4', 'A5'].map((name) => ({ name, paused: false }));
    expect(mentionSuggestions('@A', many)).toHaveLength(4);
  });
});

describe('insertMention', () => {
  it('replaces what was typed with the name and a space', () => {
    expect(insertMention('hey @tu', 'Tumbi')).toBe('hey @Tumbi ');
    expect(insertMention('@', 'Bubu')).toBe('@Bubu ');
  });

  it('leaves earlier text and earlier mentions alone', () => {
    expect(insertMention('@Bubu and @tu', 'Tumbi')).toBe('@Bubu and @Tumbi ');
  });

  it('changes nothing when no mention is being typed', () => {
    expect(insertMention('hello', 'Tumbi')).toBe('hello');
  });
});
