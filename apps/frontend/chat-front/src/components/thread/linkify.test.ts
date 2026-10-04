import { describe, expect, it } from 'vite-plus/test';
import { linkify } from './linkify';

describe('linkify', () => {
  it('leaves text without links as one run', () => {
    expect(linkify('hello there')).toEqual([{ kind: 'text', text: 'hello there' }]);
  });

  it('finds a link in the middle of a sentence', () => {
    expect(linkify('look at https://example.com/a?b=1 now')).toEqual([
      { kind: 'text', text: 'look at ' },
      { kind: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { kind: 'text', text: ' now' }
    ]);
  });

  it('adds https to a www address', () => {
    expect(linkify('www.example.com')).toEqual([
      { kind: 'link', text: 'www.example.com', href: 'https://www.example.com' }
    ]);
  });

  it('leaves the full stop and comma that end a sentence out of the link', () => {
    expect(linkify('Go to https://example.com.')[1]).toMatchObject({ href: 'https://example.com' });
    expect(
      linkify('https://a.com, https://b.com!')
        .filter((p) => p.kind === 'link')
        .map((p) => p.text)
    ).toEqual(['https://a.com', 'https://b.com']);
  });

  it('keeps a bracket the link opened, and drops one the sentence did', () => {
    expect(linkify('https://en.wikipedia.org/wiki/Tallinn_(city)')[0]).toMatchObject({
      text: 'https://en.wikipedia.org/wiki/Tallinn_(city)'
    });
    expect(linkify('(see https://example.com/page)')[1]).toMatchObject({ text: 'https://example.com/page' });
  });

  it('does not guess at bare domains or file names', () => {
    expect(linkify('open report.pdf or example.com')).toEqual([
      { kind: 'text', text: 'open report.pdf or example.com' }
    ]);
  });

  it('does not link other schemes', () => {
    expect(linkify('javascript:alert(1)')).toEqual([{ kind: 'text', text: 'javascript:alert(1)' }]);
  });

  it('keeps line breaks in the text runs', () => {
    expect(linkify('one\nhttps://x.io\ntwo').map((p) => p.text)).toEqual(['one\n', 'https://x.io', '\ntwo']);
  });
});
