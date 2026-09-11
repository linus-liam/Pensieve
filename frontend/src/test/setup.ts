import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");

// Node 26 exposes its own localStorage placeholder; use browser-like storage in jsdom.
const browserStorage = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    get length() { return browserStorage.size; },
    getItem: (key: string) => browserStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { browserStorage.set(String(key), String(value)); },
    removeItem: (key: string) => { browserStorage.delete(key); },
    clear: () => browserStorage.clear(),
    key: (index: number) => [...browserStorage.keys()][index] ?? null,
  },
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

// jsdom has no FontFaceSet; Mantine's autosizing textarea listens for font loads.
Object.defineProperty(document, "fonts", {
  configurable: true,
  value: { addEventListener: vi.fn(), removeEventListener: vi.fn(), ready: Promise.resolve() },
});
