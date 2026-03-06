import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  constructor(callback: any) {
    // Immediately call with isIntersecting: true so elements are visible
    setTimeout(() => {
      callback([{ isIntersecting: true }]);
    }, 0);
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});
