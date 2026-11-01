import {
  BAND_COPY, COMFORT, GAS_COMPENSATION, MIN_NET_DEBT, MIN_TOTAL_DEBT_AT_OPEN, POCKET_FLOOR,
  band, btcNeededForMinLoan, dropToLiquidation, liquidationPrice, maxBorrowAt, ratio,
} from "../lib/risk";
import type { MezoPosition } from "../lib/mezo";
import { IconBitcoin, IconExternal } from "./Icons";

const BORROW_URL = "https://testnet.mezo.org/feature/borrow";
const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const num = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** "Your Bitcoin on Mezo": live trove from TroveManager + PriceFeed, plus honest loan readiness. */
export function BitcoinPanel({ pos, connected }: { pos: MezoPosition; connected: boolean }) {
  const { price, trove, loading, mezo, btc, recoveryMode } = pos;
  const r = trove && price ? ratio(trove, price) : undefined;
  const b = r !== undefined ? band(r) : "none";
  const meter = r !== undefined ? Math.max(0, Math.min(100, ((r - 1.1) / (3 - 1.1)) * 100)) : 0;
  const room = trove && price ? maxBorrowAt(trove, price, COMFORT) : 0;
  const btcForMin = price ? btcNeededForMinLoan(price, COMFORT) : undefined;
  const ready = !!trove && r !== undefined && r >= POCKET_FLOOR;

  return (
    <div className="panel btc-panel" aria-labelledby="btc-title">
      <div className="account-row">
        <h3 id="btc-title" className="btc-title"><IconBitcoin width={16} height={16} /> Your Bitcoin on Mezo</h3>
        {price !== undefined && <span className="status status-ok tnum" title="From Mezo's PriceFeed on testnet">BTC {usd(price)}</span>}
      </div>

      {!connected ? (
        <p className="btc-copy">Connect a wallet to see your Mezo testnet loan. If you borrow MUSD against BTC, MUSD Pocket can send it straight into a goal.</p>
      ) : loading ? (
        <span className="skeleton" style={{ height: 64 }} />
      ) : trove && r !== undefined ? (
        <>
          <div className={`btc-ratio band-${b}`}>
            <div className="btc-ratio-top">
              <span className="btc-ratio-num tnum">{Math.round(r * 100)}%</span>
              <span className="btc-band">{BAND_COPY[b]}</span>
            </div>
            <div className="meter" role="meter" aria-valuemin={110} aria-valuemax={300} aria-valuenow={Math.round(r * 100)} aria-label="Collateral ratio">
              <i style={{ width: `${meter}%` }} />
              <span className="meter-tick" style={{ left: `${((POCKET_FLOOR - 1.1) / 1.9) * 100}%` }} title="150%" />
              <span className="meter-tick" style={{ left: `${((COMFORT - 1.1) / 1.9) * 100}%` }} title="200%" />
            </div>
            <div className="meter-legend"><span>110%</span><span>150%</span><span>200%</span><span>300%</span></div>
          </div>
          <dl className="account-meta">
            <div><dt>Collateral</dt><dd className="tnum">{num(trove.coll, 4)} BTC</dd></div>
            <div><dt>Loan</dt><dd className="tnum">{num(trove.debt)} MUSD</dd></div>
            <div><dt>Liquidation at</dt><dd className="tnum">{usd(liquidationPrice(trove))}</dd></div>
            <div><dt>BTC can fall</dt><dd className="tnum">{Math.round(dropToLiquidation(trove, price!) * 100)}%</dd></div>
          </dl>
          <p className="btc-copy">
            {room >= 1
              ? <>You could borrow about <strong className="tnum">{num(room)} MUSD</strong> into a goal and stay at 200%. We re-check the live price right before you sign.</>
              : <>Your loan is below 200%, so we don't suggest borrowing more. Adding BTC on Mezo gives you room.</>}
            {recoveryMode && <> Mezo is in Recovery Mode: loans under 150% can be liquidated.</>}
          </p>
        </>
      ) : (
        <p className="btc-copy">
          No Mezo loan on this wallet. You can still save MUSD you already hold with the plain deposit path. Borrow-into-goal stays off until you have a valid trove.
        </p>
      )}

      <div className="loan-ready" aria-labelledby="loan-ready-title">
        <h4 id="loan-ready-title">Loan readiness</h4>
        <p className="btc-copy">
          Mezo's minimum loan is <strong className="tnum">{MIN_NET_DEBT.toLocaleString()}</strong> MUSD plus a{" "}
          <strong className="tnum">{GAS_COMPENSATION}</strong> MUSD gas deposit, so total debt at open is at least{" "}
          <strong className="tnum">{MIN_TOTAL_DEBT_AT_OPEN.toLocaleString()}</strong> MUSD. That blocks small savers from borrow-into-goal; they keep the wallet deposit path.
        </p>
        {price !== undefined && btcForMin !== undefined && (
          <dl className="account-meta">
            <div><dt>BTC needed (≈200% ICR)</dt><dd className="tnum">{num(btcForMin, 4)} BTC ≈ {usd(btcForMin * price)}</dd></div>
            {btc !== undefined && <div><dt>Your test BTC</dt><dd className="tnum">{num(btc, 5)} BTC</dd></div>}
            <div><dt>Borrow-into-goal</dt><dd>{ready ? <span className="status status-ok">Ready</span> : <span className="status">Needs valid trove</span>}</dd></div>
          </dl>
        )}
      </div>

      {connected && (
        <div className="btc-foot">
          <span className="faint tnum">{mezo !== undefined ? `${num(mezo)} MEZO` : ""}</span>
          <a className="link-out" href={BORROW_URL} target="_blank" rel="noreferrer">
            {trove ? "Manage loan on Mezo" : "Open a loan on Mezo"} <IconExternal width={13} height={13} />
          </a>
        </div>
      )}
    </div>
  );
}
