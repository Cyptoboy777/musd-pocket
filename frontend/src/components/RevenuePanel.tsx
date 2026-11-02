import { IconShield } from "./Icons";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";

/** Transparent revenue model shown in-product (early-unlock fee). */
export function RevenuePanel({ lang = "en" }: { lang?: Lang }) {
  return (
    <div className="panel revenue-panel" data-feature="revenue-model" aria-labelledby="revenue-title">
      <div className="account-row">
        <h3 id="revenue-title"><IconShield width={16} height={16} /> {t(lang, "revenueTitle")}</h3>
        <span className="status status-ok tnum">{t(lang, "feeNote")}</span>
      </div>
      <p className="btc-copy">{t(lang, "revenueBody")}</p>
      <dl className="account-meta">
        <div><dt>Early unlock</dt><dd className="tnum">2% fee</dd></div>
        <div><dt>Contract cap</dt><dd className="tnum">5% max</dd></div>
        <div><dt>Chip-in</dt><dd className="tnum">0%</dd></div>
        <div><dt>On-time unlock</dt><dd className="tnum">0%</dd></div>
      </dl>
    </div>
  );
}
