import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// findBy* and waitFor wait up to 20 s rather than 1 s, for the same reason as the test timeout:
// the first of a file's tests to reach a lazy screen loads all of it, next to every other file,
// and the wait only lengthens a test that would fail.
configure({ asyncUtilTimeout: 20_000 });

// jsdom has no layout engine: give elements a desktop-sized box and a ResizeObserver that
// reports once, so the map camera can frame itself in component tests.
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1280 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 720 });

class TestResizeObserver {
  readonly #callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }
  observe(): void {
    queueMicrotask(() => { this.#callback([], this); });
  }
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = TestResizeObserver;

// jsdom does not implement pointer capture.
HTMLElement.prototype.setPointerCapture = function setPointerCapture(): void {};

// jsdom does not scroll.
HTMLElement.prototype.scrollIntoView = function scrollIntoView(): void {};
