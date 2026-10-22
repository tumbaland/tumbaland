/** Start fetching the map while the browser is finding a position, rather than after it. */
let pending: Promise<typeof import('./LiveMap')> | null = null;

export function loadLiveMap(): Promise<typeof import('./LiveMap')> {
  if (!pending)
    pending = import('./LiveMap').catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

export function preloadLiveMap(): void {
  void loadLiveMap().catch(() => undefined);
}
