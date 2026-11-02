import { EXPLORER, LIVE_APP, PROOF_WALLETS } from "../lib/proof";
import { IconExternal } from "./Icons";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";

/** On-chain proof: my own Mezo testnet wallets + empty Community testers slot. */
export function ProofPanel({ lang = "en" }: { lang?: Lang }) {
  return (
    <section id="proof" className="proof-section" aria-labelledby="proof-title">
      <div className="section-head">
        <h2 id="proof-title">Proof (Mezo testnet)</h2>
        <p>
          Live app:{" "}
          <a href={LIVE_APP} target="_blank" rel="noreferrer">{LIVE_APP.replace("https://", "")}</a>.
          Self wallets stay labelled honestly. Community testers stay empty until real third parties try the app.
        </p>
      </div>

      <h3 className="proof-sub">{t(lang, "selfTitle")}</h3>
      <div className="proof-grid">
        {PROOF_WALLETS.map((w) => (
          <article key={w.address} className="panel proof-card">
            <header className="proof-card-head">
              <h3>{w.label}</h3>
              <a className="tnum link-out" href={`${EXPLORER}/address/${w.address}`} target="_blank" rel="noreferrer">
                {w.address.slice(0, 6)}…{w.address.slice(-4)} <IconExternal width={13} height={13} />
              </a>
            </header>
            <p className="btc-copy">{w.note}</p>
            <ul className="proof-txs">
              {w.txs.map((tx) => (
                <li key={tx.hash}>
                  <a className="tnum" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                    {tx.label}: {tx.hash.slice(0, 10)}… <IconExternal width={12} height={12} />
                  </a>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <h3 className="proof-sub" id="community-testers">{t(lang, "communityTitle")}</h3>
      <div className="panel proof-card proof-community-empty" data-feature="community-testers-empty">
        <p className="btc-copy">{t(lang, "communityEmpty")}</p>
        <p className="btc-copy faint">Format when ready: address · role · explorer tx links. No fake users.</p>
      </div>

      <p className="btc-copy faint" style={{ marginTop: 16 }}>
        Contracts: v2{" "}
        <a href={`${EXPLORER}/address/0xEC03F758219746b6e773f107a05cF17b66E7D460`} target="_blank" rel="noreferrer">0xEC03…D460</a>
        {" "}(verified) · v1{" "}
        <a href={`${EXPLORER}/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`} target="_blank" rel="noreferrer">0x2d5f…A1C8</a>.
      </p>
    </section>
  );
}
