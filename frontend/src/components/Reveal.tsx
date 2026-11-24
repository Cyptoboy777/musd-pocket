import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades and lifts its content in once, the first time it scrolls into view.
 * Uses IntersectionObserver and CSS only (transform and opacity), so it costs no layout.
 * If the browser has no IntersectionObserver the content simply shows.
 * Reduced motion is handled in redesign.css.
 */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal${seen ? " is-in" : ""}`}>
      {children}
    </div>
  );
}
