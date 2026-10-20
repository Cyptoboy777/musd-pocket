import { useEffect, useRef, useState } from "react";

const reduce = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animates a number toward `target` with an expo-out curve. Jumps instantly under reduced motion. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    if (reduce() || !Number.isFinite(target)) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const v = a + (target - a) * e;
      setValue(v);
      from.current = v;
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return value;
}
