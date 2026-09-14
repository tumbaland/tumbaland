import { afterEach, describe, expect, it } from 'vitest';
import { getAppByRoute, getUserApps } from './apps';

const inNativeApp = () => {
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
};

afterEach(() => {
  delete window.Capacitor;
});

describe('on the website', () => {
  it('lists every account entry, Billing included', () => {
    expect(getUserApps().map((app) => app.name)).toEqual(['Profile', 'Groups', 'Billing']);
  });

  it('resolves nested routes to their app', () => {
    expect(getAppByRoute('/album/albums/64f2')?.name).toBe('Album');
    expect(getAppByRoute('/payments/plans')?.name).toBe('Billing');
  });
});

describe('inside a native app', () => {
  it('lists no Billing', () => {
    inNativeApp();
    expect(getUserApps().map((app) => app.name)).toEqual(['Profile', 'Groups']);
  });

  it('does not frame Billing from a link or bookmark', () => {
    inNativeApp();
    expect(getAppByRoute('/payments/plans')).toBeUndefined();
    expect(getAppByRoute('/finance')?.name).toBe('Money');
  });
});
