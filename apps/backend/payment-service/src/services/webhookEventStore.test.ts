afterEach(() => {
  jest.resetModules();
});

describe('ensureEventStore', () => {
  it('reports an unseen id as not processed', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');
      const store = ensureEventStore();

      expect(store.has('evt_unseen')).toBe(false);
    });
  });

  it('marks an id as processed after add', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');
      const store = ensureEventStore();

      store.add('evt_1');

      expect(store.has('evt_1')).toBe(true);
    });
  });

  it('treats a repeated add as idempotent', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');
      const store = ensureEventStore();

      store.add('evt_1');
      store.add('evt_1');

      expect(store.has('evt_1')).toBe(true);
    });
  });

  it('tracks distinct ids independently', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');
      const store = ensureEventStore();

      store.add('evt_1');

      expect(store.has('evt_1')).toBe(true);
      expect(store.has('evt_2')).toBe(false);
    });
  });

  it('shares state across ensureEventStore() calls (the idempotency guarantee)', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');

      // A later webhook request obtains its own handle but must see events
      // recorded by an earlier one — otherwise the duplicate guard is useless.
      ensureEventStore().add('evt_shared');

      expect(ensureEventStore().has('evt_shared')).toBe(true);
    });
  });

  it('does not persist across module reloads (in-memory only)', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');
      ensureEventStore().add('evt_gone');
    });

    await jest.isolateModulesAsync(async () => {
      const { ensureEventStore } = await import('./webhookEventStore');
      expect(ensureEventStore().has('evt_gone')).toBe(false);
    });
  });
});
