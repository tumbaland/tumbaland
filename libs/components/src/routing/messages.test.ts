import { describe, it, expect } from 'vitest';
import {
  APP_SOURCE,
  SHELL_SOURCE,
  isAppLocationMessage,
  isNavigateTopMessage,
  isShellNavigateMessage
} from './messages';

describe('isShellNavigateMessage', () => {
  it('accepts a well-formed shell message', () => {
    expect(isShellNavigateMessage({ source: SHELL_SOURCE, type: 'shell:navigate', path: '/x' })).toBe(true);
  });

  it('rejects foreign, malformed, and non-object payloads', () => {
    expect(isShellNavigateMessage({ source: 'someone-else', type: 'shell:navigate', path: '/x' })).toBe(false);
    expect(isShellNavigateMessage({ source: SHELL_SOURCE, type: 'shell:navigate' })).toBe(false);
    expect(isShellNavigateMessage({ source: SHELL_SOURCE, type: 'other', path: '/x' })).toBe(false);
    expect(isShellNavigateMessage(null)).toBe(false);
    expect(isShellNavigateMessage('shell:navigate')).toBe(false);
  });
});

describe('isAppLocationMessage', () => {
  it('accepts a well-formed app message', () => {
    expect(isAppLocationMessage({ source: APP_SOURCE, type: 'app:location', app: 'album-front', path: '/x' })).toBe(
      true
    );
  });

  it('rejects payloads missing required fields', () => {
    expect(isAppLocationMessage({ source: APP_SOURCE, type: 'app:location', path: '/x' })).toBe(false);
    expect(isAppLocationMessage({ source: APP_SOURCE, type: 'app:location', app: 'album-front' })).toBe(false);
    expect(isAppLocationMessage(undefined)).toBe(false);
  });
});

describe('isNavigateTopMessage', () => {
  it('accepts the legacy payment-front payload with its own source', () => {
    expect(isNavigateTopMessage({ source: 'payment-front', type: 'tumbaland:navigate-top', url: 'https://x/' })).toBe(
      true
    );
  });

  it('rejects payloads without a url', () => {
    expect(isNavigateTopMessage({ source: 'payment-front', type: 'tumbaland:navigate-top' })).toBe(false);
    expect(isNavigateTopMessage(42)).toBe(false);
  });
});
