import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// This jsdom environment doesn't provide a working localStorage/sessionStorage
// (window.localStorage is undefined here, and Node's own experimental global
// storage errors without --localstorage-file) — polyfill both with a simple
// in-memory Storage so component code that reads/writes tenant selection
// doesn't crash. Same pattern as every frontend app's src/test/setup.ts.
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

// jsdom doesn't implement ResizeObserver — used by MUI's Popper-based components (Menu, etc).
if (!window.ResizeObserver) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
