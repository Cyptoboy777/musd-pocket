import { BAND_COPY, band } from "../lib/risk";
import { GAUGE_MAX, GAUGE_MIN, GAUGE_ZONES, gaugeArc, gaugeFraction, gaugeTone, needleDegrees } from "../lib/gauge";

const CX = 100;
const CY = 100;
const R = 78;

/** Loan health as a half-circle gauge. Colour is never the only signal: the percentage and the label are always written out. */
export function HealthGauge({ ratio }: { ratio: number | undefined }) {
  const known = ratio !== undefined;
  const r = known ? ratio : GAUGE_MIN;
  const tone = gaugeTone(r);
  const pct = known && Number.isFinite(r) ? `${Math.round(r * 100)}%` : known ? "No debt" : "—";
  const label = known ? BAND_COPY[band(r)] : "No loan";
  const span = GAUGE_MAX - GAUGE_MIN;

  return (
    <div className={`gauge tone-${tone}${known ? "" : " is-empty"}`} data-feature="health-gauge">
      <svg viewBox="0 0 200 116" role="img" aria-label={known ? `Loan health ${pct}, ${label}` : "No loan to show"}>
        {GAUGE_ZONES.map((z) => (
          <path
            key={z.tone}
            className={`gauge-zone zone-${z.tone}`}
            d={gaugeArc(CX, CY, R, (z.from - GAUGE_MIN) / span, (z.to - GAUGE_MIN) / span)}
          />
        ))}
        <path className="gauge-fill" d={gaugeArc(CX, CY, R, 0, Math.max(0.004, gaugeFraction(r)))} pathLength={1} />
        {[1.1, 1.5, 2.0].map((t) => {
          const f = (t - GAUGE_MIN) / span;
          const a = gaugeArc(CX, CY, R + 9, f, f + 0.0001);
          return <path key={t} className="gauge-tick" d={a} />;
        })}
        <g className="gauge-needle" style={{ transform: `rotate(${known ? needleDegrees(r) : -90}deg)` }}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 10} />
          <circle cx={CX} cy={CY} r="6" />
        </g>
      </svg>
      <div className="gauge-read">
        <strong className="tnum">{pct}</strong>
        <span>{label}</span>
      </div>
      <p className="gauge-legend">Liquidated below 110%. Recovery line 150%. Comfortable from 200%.</p>
    </div>
  );
}
