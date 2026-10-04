/// <reference types="@testing-library/jest-dom/vitest" />
import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vite-plus/test';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia — MUI's useMediaQuery needs it.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

// jsdom doesn't implement ResizeObserver — used by MUI components and charts.
if (!window.ResizeObserver) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

// This jsdom environment doesn't provide a working localStorage/sessionStorage
// (window.localStorage is undefined here, and Node's own experimental global
// storage errors without --localstorage-file) — polyfill both with a simple
// in-memory Storage so app code that reads/writes tokens doesn't crash.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const memoryLocalStorage = new MemoryStorage();
const memorySessionStorage = new MemoryStorage();

vi.stubGlobal('localStorage', memoryLocalStorage);
vi.stubGlobal('sessionStorage', memorySessionStorage);
Object.defineProperty(window, 'localStorage', { value: memoryLocalStorage, configurable: true });
Object.defineProperty(window, 'sessionStorage', { value: memorySessionStorage, configurable: true });

// Never let a test hit the real network. Keyed by URL rather than call
// order, since several components can fetch concurrently on mount —
// `/auth/verify` defaults to an authenticated response so
// ProtectedRoute-gated pages render; everything else gets a generic OK.
function defaultFetchMock(input: RequestInfo | URL) {
  const href = typeof input === 'string' ? input : input.toString();

  if (href.includes('/auth/verify')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        authenticated: true,
        user: { id: 'test-user', email: 'test@example.com', name: 'Test User' }
      }),
      text: async () => ''
    } as Response);
  }

  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
    text: async () => ''
  } as Response);
}

beforeEach(() => {
  global.fetch = vi.fn(defaultFetchMock) as unknown as typeof fetch;
});
