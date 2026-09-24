import { useCallback, useRef, useState } from "react";

/**
 * Measures an element's box via ResizeObserver, using a callback ref so the
 * observer re-attaches whenever the element itself changes (e.g. a chart
 * that swaps between an empty-state div and a data div on the same spot).
 */
export function useMeasuredSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const [size, setSize] = useState(fallback);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const fb = fallbackRef.current;
      setSize({ width: e.contentRect.width || fb.width, height: e.contentRect.height || fb.height });
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  return { ref, ...size };
}
