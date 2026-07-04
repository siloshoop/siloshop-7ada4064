import { describe, it, expect, vi } from "vitest";
import { measureFrames } from "@/lib/perfMonitor";

describe("perfMonitor.measureFrames", () => {
  it("returns a sample with reducedMotion flag and frame stats", async () => {
    // jsdom lacks rAF — provide one that ticks at ~16ms
    let t = 0;
    const origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      t += 16;
      return setTimeout(() => cb(t), 0) as unknown as number;
    }) as typeof requestAnimationFrame;

    (window as any).matchMedia = (q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    const sample = await measureFrames("test", 100);
    expect(sample.label).toBe("test");
    expect(sample.reducedMotion).toBe(true);
    expect(sample.samples).toBeGreaterThan(0);
    expect(sample.avgFrameMs).toBeGreaterThanOrEqual(0);
    expect((window as any).__perf?.length).toBeGreaterThan(0);

    globalThis.requestAnimationFrame = origRaf;
  });
});