import { afterEach, describe, expect, it } from 'vite-plus/test';
import { USER_APPS, getAppByRoute, getMainApps, getUserApps } from './apps';

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

it('lists Money in the main menu only for someone who turned it on', () => {
  expect(getMainApps().map((app) => app.name)).toEqual(['Home', 'Journal', 'Album']);
  expect(getMainApps({ showMoney: true }).map((app) => app.name)).toEqual(['Home', 'Journal', 'Album', 'Money']);
  // Never in the account menu, whichever way it is set.
  expect(getUserApps().map((app) => app.name)).not.toContain('Money');
  // Its pages work by address either way.
  expect(getAppByRoute('/finance/net-worth')?.name).toBe('Money');
});

it('offers Features among the Profile sections, where the switch lives', () => {
  const profile = USER_APPS.find((app) => app.name === 'Profile')!;
  expect(profile.menu?.map((item) => item.label)).toContain('Features');
  expect(profile.menu?.find((item) => item.label === 'Features')?.route).toBe('/account/features');
});
