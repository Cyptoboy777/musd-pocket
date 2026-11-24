/**
 * Geometry for the loan-health gauge: a half circle that runs from 100% (left) to 300% (right).
 * Pure functions so the picture and its tests share one source of truth.
 */

export const GAUGE_MIN = 1.0;
export const GAUGE_MAX = 3.0;

export type GaugeTone = "danger" | "risky" | "watch" | "ok";

/** Colour zones. They line up with Mezo's lines: 110% liquidation, 150% Recovery Mode, 200% comfortable. */
export const GAUGE_ZONES: { from: number; to: number; tone: GaugeTone }[] = [
  { from: GAUGE_MIN, to: 1.1, tone: "danger" },
  { from: 1.1, to: 1.5, tone: "risky" },
  { from: 1.5, to: 2.0, tone: "watch" },
  { from: 2.0, to: GAUGE_MAX, tone: "ok" },
];

/** 0 at the left end, 1 at the right end. Non-finite ratios (no debt) sit at the safe end. */
export function gaugeFraction(r: number): number {
  if (!Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, (r - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)));
}

export function gaugeTone(r: number): GaugeTone {
  if (!Number.isFinite(r)) return "ok";
  for (const z of GAUGE_ZONES) if (r < z.to) return z.tone;
  return "ok";
}

/** Point on the half circle. fraction 0 is the left end, 0.5 the top, 1 the right end. */
export function gaugePoint(cx: number, cy: number, radius: number, fraction: number): { x: number; y: number } {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, fraction)));
  return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** SVG path for the arc between two fractions of the half circle. */
export function gaugeArc(cx: number, cy: number, radius: number, from: number, to: number): string {
  const a = gaugePoint(cx, cy, radius, from);
  const b = gaugePoint(cx, cy, radius, to);
  return `M ${r2(a.x)} ${r2(a.y)} A ${radius} ${radius} 0 0 1 ${r2(b.x)} ${r2(b.y)}`;
}

/** Needle angle in degrees for CSS rotate(): -90 at the left end, 0 at the top, 90 at the right end. */
export function needleDegrees(r: number): number {
  return -90 + 180 * gaugeFraction(r);
}
