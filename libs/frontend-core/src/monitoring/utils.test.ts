import { generateCorrelationId, getCorrelationId, getSessionId } from './utils';

describe('generateCorrelationId', () => {
  it('returns a unique UUID each call', () => {
    const a = generateCorrelationId();
    const b = generateCorrelationId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('getSessionId', () => {
  it('returns the same id across calls (persists for the module lifetime)', () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
  });
});

describe('getCorrelationId', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('reads the value from a server-set meta tag when present', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'x-correlation-id');
    meta.setAttribute('content', 'server-set-id');
    document.head.appendChild(meta);

    expect(getCorrelationId()).toBe('server-set-id');
  });

  it('generates a fresh id when no meta tag is present', () => {
    const id = getCorrelationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('generates a fresh id when the meta tag has no content attribute', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'x-correlation-id');
    document.head.appendChild(meta);

    const id = getCorrelationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
