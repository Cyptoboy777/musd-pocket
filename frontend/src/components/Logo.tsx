import { useId } from "react";

/**
 * MUSD Pocket mark: two engraved lines (the double stroke shared by currency
 * signs and security-print guilloche) form a pocket that cradles a coin.
 * The gap around the coin is the lock: held, not touched.
 */
export function LogoMark({ size = 32, mono = false }: { size?: number; mono?: boolean }) {
  const id = useId().replace(/:/g, "");
  const paint = mono ? "currentColor" : `url(#g${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={`g${id}`} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F6E3B4" />
          <stop offset=".55" stopColor="#E6C27A" />
          <stop offset="1" stopColor="#B8893F" />
        </linearGradient>
        <mask id={`k${id}`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="32" cy="23" r="13.5" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#k${id})`} fill="none" stroke={paint} strokeWidth="3.4" strokeLinecap="round">
        <path className="logo-line" pathLength={1} d="M10 14V32a22 22 0 0 0 44 0V14" />
        <path className="logo-line" pathLength={1} d="M16.5 14V32a15.5 15.5 0 0 0 31 0V14" />
      </g>
      <circle className="logo-coin" cx="32" cy="23" r="10" fill={paint} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark size={30} />
      <span className="wordmark-text">MUSD Pocket</span>
    </span>
  );
}
