/**
 * Where the shell is running: a browser, or a native iOS or Android app that
 * wraps the site (see "Mobile apps" in the README).
 *
 * Nothing here needs a wrapper to exist. A Capacitor app injects
 * `window.Capacitor` before any page script runs, so a browser never has it and
 * everything below answers "web".
 */
export type AppPlatform = 'web' | 'ios' | 'android';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export function getAppPlatform(
  win: { Capacitor?: CapacitorGlobal } | undefined = typeof window === 'undefined' ? undefined : window
): AppPlatform {
  const capacitor = win?.Capacitor;
  // Capacitor also runs in a plain browser for development, where it reports
  // itself as not native.
  if (!capacitor?.isNativePlatform?.()) return 'web';
  const platform = capacitor.getPlatform?.();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

export const isNativeApp = (): boolean => getAppPlatform() !== 'web';

/**
 * Whether plans, checkout and supporter payments may be shown.
 *
 * The App Store and Google Play require their own billing for anything digital
 * bought inside an app, supporter plans and tips included, and reject apps that
 * send people to another checkout. So the apps show none of it until they take
 * payments through the stores; the website is unaffected.
 */
export const canOfferPurchases = (): boolean => !isNativeApp();
