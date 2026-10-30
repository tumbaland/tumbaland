import { chatText, withSources } from './chatText';

describe('chatText', () => {
  it('drops bold, italic and code marks', () => {
    expect(chatText('Try **Kolm Sõpra** or *F-hoone*, both `open late`.')).toBe('Try Kolm Sõpra or F-hoone, both open late.');
    expect(chatText('__Really__ _good_ ~~bad~~')).toBe('Really good bad');
  });

  it('leaves what only looks like emphasis', () => {
    expect(chatText('2 * 3 * 4 = 24, file_name_here and a * alone')).toBe('2 * 3 * 4 = 24, file_name_here and a * alone');
  });

  it('turns list items into bullets and keeps numbered lists', () => {
    expect(chatText('Options:\n- **Kolm Sõpra**: 25 EUR\n* Moon\n  - nested\n1. first\n2. second')).toBe(
      'Options:\n• Kolm Sõpra: 25 EUR\n• Moon\n  • nested\n1. first\n2. second'
    );
  });

  it('turns headings into plain lines and drops rules and quote marks', () => {
    expect(chatText('## Tonight\n\n---\n> worth it')).toBe('Tonight\n\nworth it');
  });

  it('keeps a link’s address so the bubble can link it', () => {
    expect(chatText('See [the menu](https://kolm.ee/menu) or <https://moon.ee>')).toBe('See the menu (https://kolm.ee/menu) or https://moon.ee');
    expect(chatText('[https://a.ee](https://a.ee)')).toBe('https://a.ee');
  });

  it('keeps code blocks as they are, without the fences', () => {
    expect(chatText('```\n**raw** - text\n```')).toBe('**raw** - text');
  });

  it('closes up the gaps it leaves', () => {
    expect(chatText('a\n\n\n\n---\n\nb')).toBe('a\n\nb');
  });
});

describe('withSources', () => {
  const sources = [
    { url: 'https://kolm.ee', title: 'Kolm Sõpra' },
    { url: 'https://moon.ee', title: 'https://moon.ee' },
    { url: 'https://c.ee', title: 'C' },
    { url: 'https://d.ee', title: 'D' }
  ];

  it('lists up to three pages the reply drew on, one to a line', () => {
    expect(withSources('Try Kolm Sõpra.', sources)).toBe('Try Kolm Sõpra.\n\nSources:\n• Kolm Sõpra: https://kolm.ee\n• https://moon.ee\n• C: https://c.ee');
  });

  it('leaves out a page the reply already links, and adds nothing when there is nothing', () => {
    expect(withSources('See https://kolm.ee', [sources[0]!])).toBe('See https://kolm.ee');
    expect(withSources('Hi', [])).toBe('Hi');
  });
});
