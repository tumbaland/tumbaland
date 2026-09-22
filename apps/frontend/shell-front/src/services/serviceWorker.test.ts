import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setWaitingWorker, applyUpdate, onWorkerMessage, registerServiceWorker } from './serviceWorker';

/** A registration whose lifecycle events the test drives. */
function fakeRegistration(waiting: unknown = null) {
  const listeners = new Map<string, () => void>();
  return {
    waiting,
    installing: null as unknown,
    addEventListener: (event: string, handler: () => void) => listeners.set(event, handler),
    fire: (event: string) => listeners.get(event)?.()
  };
}

function fakeWorker(state = 'installing') {
  const listeners = new Map<string, () => void>();
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: (event: string, handler: () => void) => listeners.set(event, handler),
    fire: (event: string) => listeners.get(event)?.()
  };
}

const register = vi.fn();
const swListeners = new Map<string, (event: unknown) => void>();
let controller: unknown = {};

beforeEach(() => {
  swListeners.clear();
  controller = {};
  vi.stubGlobal('navigator', {
    serviceWorker: {
      register,
      get controller() {
        return controller;
      },
      addEventListener: (event: string, handler: (event: unknown) => void) => swListeners.set(event, handler),
      removeEventListener: (event: string) => swListeners.delete(event)
    }
  });
  vi.stubGlobal('window', {
    addEventListener: (event: string, handler: () => void) => event === 'load' && handler(),
    removeEventListener: vi.fn(),
    location: { reload: vi.fn(), href: 'https://tumbaland.test/' }
  });
  __setWaitingWorker(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('registerServiceWorker', () => {
  it('registers the worker at the origin root', async () => {
    register.mockResolvedValue(fakeRegistration());

    registerServiceWorker(undefined, { enabled: true });
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('registers when the layout mounts after the page has already loaded', async () => {
    register.mockResolvedValue(fakeRegistration());
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    window.addEventListener = vi.fn();

    registerServiceWorker(undefined, { enabled: true });
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith('/sw.js');
    vi.restoreAllMocks();
  });

  it('does not reload when the first worker claims the page', async () => {
    controller = null;
    register.mockResolvedValue(fakeRegistration());
    registerServiceWorker(undefined, { enabled: true });
    await Promise.resolve();
    swListeners.get('controllerchange')?.(undefined);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('reloads for an update accepted after the first worker claimed the page', async () => {
    controller = null;
    register.mockResolvedValue(fakeRegistration());
    registerServiceWorker(undefined, { enabled: true });
    await Promise.resolve();
    swListeners.get('controllerchange')?.(undefined);
    swListeners.get('controllerchange')?.(undefined);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('removes listeners when the layout unmounts', () => {
    register.mockResolvedValue(fakeRegistration());
    const stop = registerServiceWorker(undefined, { enabled: true });
    stop();
    expect(swListeners.has('controllerchange')).toBe(false);
    expect(window.removeEventListener).toHaveBeenCalledWith('load', expect.any(Function));
  });

  it('reports an update that was already waiting from a previous visit', async () => {
    const onUpdate = vi.fn();
    register.mockResolvedValue(fakeRegistration(fakeWorker('installed')));

    registerServiceWorker(onUpdate, { enabled: true });
    await Promise.resolve();

    expect(onUpdate).toHaveBeenCalled();
  });

  it('reports an update that installs while the page is open', async () => {
    const onUpdate = vi.fn();
    const registration = fakeRegistration();
    const installing = fakeWorker('installing');
    register.mockResolvedValue(registration);

    registerServiceWorker(onUpdate, { enabled: true });
    await Promise.resolve();
    await Promise.resolve();

    registration.installing = installing;
    registration.fire('updatefound');
    installing.state = 'installed';
    installing.fire('statechange');

    expect(onUpdate).toHaveBeenCalled();
  });

  it('does not prompt on the very first install', async () => {
    // `controller` is null before any worker has ever controlled the page.
    // That is an install, not an update, and prompting would be nonsense.
    controller = null;
    const onUpdate = vi.fn();
    const registration = fakeRegistration();
    const installing = fakeWorker('installing');
    register.mockResolvedValue(registration);

    registerServiceWorker(onUpdate, { enabled: true });
    await Promise.resolve();
    await Promise.resolve();

    registration.installing = installing;
    registration.fire('updatefound');
    installing.state = 'installed';
    installing.fire('statechange');

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('survives a failed registration', async () => {
    register.mockRejectedValue(new Error('insecure context'));

    expect(() => registerServiceWorker()).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing where service workers are unavailable', () => {
    vi.stubGlobal('navigator', {});

    expect(() => registerServiceWorker()).not.toThrow();
    expect(register).not.toHaveBeenCalled();
  });

  it('reloads once the new worker takes over, and only once', async () => {
    register.mockResolvedValue(fakeRegistration());
    registerServiceWorker(undefined, { enabled: true });
    await Promise.resolve();

    swListeners.get('controllerchange')?.(undefined);
    swListeners.get('controllerchange')?.(undefined);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe('applyUpdate', () => {
  it('asks the waiting worker to take over', async () => {
    const waiting = fakeWorker('installed');
    register.mockResolvedValue(fakeRegistration(waiting));
    registerServiceWorker(() => {}, { enabled: true });
    await Promise.resolve();

    applyUpdate();

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('does nothing when no update is waiting', () => {
    expect(() => applyUpdate()).not.toThrow();
  });

  it('cannot be applied twice', async () => {
    const waiting = fakeWorker('installed');
    register.mockResolvedValue(fakeRegistration(waiting));
    registerServiceWorker(() => {}, { enabled: true });
    await Promise.resolve();

    applyUpdate();
    applyUpdate();

    expect(waiting.postMessage).toHaveBeenCalledTimes(1);
  });
});

describe('onWorkerMessage', () => {
  it('passes a worker message to the handler', () => {
    const handler = vi.fn();
    onWorkerMessage(handler);

    swListeners.get('message')?.({ data: { type: 'NAVIGATE', url: '/chat/c1' } });

    expect(handler).toHaveBeenCalledWith({ type: 'NAVIGATE', url: '/chat/c1' });
  });

  it('ignores a message with no type', () => {
    const handler = vi.fn();
    onWorkerMessage(handler);

    swListeners.get('message')?.({ data: 'hello' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops listening when unsubscribed', () => {
    const stop = onWorkerMessage(vi.fn());

    stop();

    expect(swListeners.has('message')).toBe(false);
  });

  it('is a no-op where service workers are unavailable', () => {
    vi.stubGlobal('navigator', {});

    expect(() => onWorkerMessage(vi.fn())()).not.toThrow();
  });
});

describe('the dev guard', () => {
  it('does not register in a dev build', () => {
    registerServiceWorker(undefined, { enabled: false });

    expect(register).not.toHaveBeenCalled();
  });
});
