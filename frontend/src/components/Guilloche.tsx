import { memo, useEffect, useRef } from "react";

type Band = { r: number; amp: number; lobes: number; lines: number; spread: number };

function bandPaths({ r, amp, lobes, lines, spread }: Band, steps = 540) {
  // Classic guilloche band: phase-shifted sine rings interlace into a woven mesh.
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    const phase = (i / lines) * Math.PI * 2;
    let d = "";
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * Math.PI * 2;
      const rad = r + amp * Math.sin(lobes * t + phase) + spread * Math.sin(3 * t + phase * 0.5) * 0.15;
      const x = 300 + rad * Math.cos(t);
      const y = 300 + rad * Math.sin(t);
      d += (s ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    out.push(d + "Z");
  }
  return out;
}

const BANDS: Band[] = [
  { r: 264, amp: 12, lobes: 40, lines: 14, spread: 6 },
  { r: 204, amp: 30, lobes: 18, lines: 18, spread: 6 },
  { r: 132, amp: 22, lobes: 12, lines: 14, spread: 4 },
  { r: 70, amp: 14, lobes: 8, lines: 10, spread: 2 },
];
const PATHS = BANDS.map((b) => bandPaths(b));

/** Engraved security-print rosette. Lines draw in once, then the plate turns slowly (paused offscreen). */
export const Guilloche = memo(function Guilloche({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("is-paused", !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 600 600" className={`guilloche ${className}`} aria-hidden="true">
      {PATHS.map((band, bi) => (
        <g key={bi} className={`g-band g-band-${bi}`}>
          {band.map((d, i) => (
            <path key={i} d={d} pathLength={1} style={{ animationDelay: `${100 + bi * 160 + i * 18}ms` }} />
          ))}
        </g>
      ))}
    </svg>
  );
});
