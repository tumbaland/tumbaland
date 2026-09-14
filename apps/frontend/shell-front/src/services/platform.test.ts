import { afterEach, describe, expect, it } from 'vitest';
import { canOfferPurchases, getAppPlatform, isNativeApp } from './platform';

const nativeApp = (platform: string) => ({
  isNativePlatform: () => true,
  getPlatform: () => platform
});

afterEach(() => {
  delete window.Capacitor;
});

describe('getAppPlatform', () => {
  it('is web in a browser, where there is no wrapper', () => {
    expect(getAppPlatform({})).toBe('web');
    expect(getAppPlatform(undefined)).toBe('web');
  });

  it('names the native platform inside an app', () => {
    expect(getAppPlatform({ Capacitor: nativeApp('ios') })).toBe('ios');
    expect(getAppPlatform({ Capacitor: nativeApp('android') })).toBe('android');
  });

  it('is web when Capacitor runs in a browser for development', () => {
    expect(getAppPlatform({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } })).toBe('web');
  });

  it('is web for a platform the site does not ship to', () => {
    expect(getAppPlatform({ Capacitor: nativeApp('electron') })).toBe('web');
  });
});

describe('isNativeApp and canOfferPurchases', () => {
  it('offers purchases on the website', () => {
    expect(isNativeApp()).toBe(false);
    expect(canOfferPurchases()).toBe(true);
  });

  it('offers no purchases inside a native app', () => {
    window.Capacitor = nativeApp('ios');

    expect(isNativeApp()).toBe(true);
    expect(canOfferPurchases()).toBe(false);
  });
});
