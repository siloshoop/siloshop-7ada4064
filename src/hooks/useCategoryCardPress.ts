import { useCallback, useRef, useState } from "react";

/**
 * One-shot press effect for touch & mouse.
 * - Triggers a brief "pressed" state on pointer down
 * - Auto-clears after ~180ms so the visual cannot get stuck after tap
 * - Cancels if pointer leaves / is interrupted (avoids jitter while scrolling)
 */
export function useCategoryCardPress(durationMs = 180) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setPressed(false);
  }, []);

  const onPointerDown = useCallback(() => {
    setPressed(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPressed(false);
      timer.current = null;
    }, durationMs);
  }, [durationMs]);

  return {
    pressed,
    handlers: {
      onPointerDown,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  };
}