/**
 * Lightweight performance logger for animated UI surfaces.
 * Measures rAF frame intervals over a window and reports avg/max + dropped frames.
 * Results are stored on window.__perf so they can be compared before/after
 * toggling prefers-reduced-motion.
 */
export interface PerfSample {
  label: string;
  reducedMotion: boolean;
  avgFrameMs: number;
  maxFrameMs: number;
  droppedFrames: number; // frames > 32ms (~ <30fps)
  samples: number;
  device: string;
  timestamp: number;
}

declare global {
  interface Window {
    __perf?: PerfSample[];
  }
}

export function measureFrames(label: string, durationMs = 1000): Promise<PerfSample> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
      resolve({
        label,
        reducedMotion: false,
        avgFrameMs: 0,
        maxFrameMs: 0,
        droppedFrames: 0,
        samples: 0,
        device: "unknown",
        timestamp: Date.now(),
      });
      return;
    }

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = performance.now();
    let last = start;
    const deltas: number[] = [];

    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
      } else {
        const avg = deltas.reduce((a, b) => a + b, 0) / Math.max(deltas.length, 1);
        const max = deltas.reduce((a, b) => Math.max(a, b), 0);
        const dropped = deltas.filter((d) => d > 32).length;
        const sample: PerfSample = {
          label,
          reducedMotion,
          avgFrameMs: +avg.toFixed(2),
          maxFrameMs: +max.toFixed(2),
          droppedFrames: dropped,
          samples: deltas.length,
          device: navigator.userAgent.slice(0, 80),
          timestamp: Date.now(),
        };
        window.__perf = window.__perf || [];
        window.__perf.push(sample);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info("[perf]", sample);
        }
        resolve(sample);
      }
    };
    requestAnimationFrame(tick);
  });
}