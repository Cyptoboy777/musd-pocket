import { useMemo, useState } from "react";
import { useMezoActions, type MezoPosition } from "../lib/mezo";
import {
  BAND_COPY, COMFORT, band, liquidationPrice, protectLevel,
  ratio, ratioAfterAddColl, ratioAfterRepay,
} from "../lib/risk";
import { useAsyncTx } from "../hooks/useAsyncTx";
import { IconBitcoin, IconShield } from "./Icons";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";
import { ConfirmDialog } from "./ConfirmDialog";

const num = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Protect my loan: warn as ICR approaches danger; one-click addColl / repay via
 * BorrowerOperations with hints; show ICR + liq price effect before send.
 */
export function ProtectLoanPanel({
  pos, connected, lang = "en", musdBalance = 0,
}: {
  pos: MezoPosition;
  connected: boolean;
  lang?: Lang;
  musdBalance?: number;
}) {
  const { trove, price, loading } = pos;
  const actions = useMezoActions();
  const [mode, setMode] = useState<"add" | "repay">("add");
  const [btcAmt, setBtcAmt] = useState("0.001");
  const [repayAmt, setRepayAmt] = useState("50");
  const [closeOpen, setCloseOpen] = useState(false);
  const addTx = useAsyncTx("protect-add", "Added collateral");
  const repayTx = useAsyncTx("protect-repay", "Repaid MUSD");
  const closeTx = useAsyncTx("protect-close", "Closed trove");

  const r = trove && price ? ratio(trove, price) : undefined;
  const level = protectLevel(r);
  const btcN = Number(btcAmt) || 0;
  const repayN = Number(repayAmt) || 0;
  const debtNeeded = trove ? trove.debt : 0;
  const canClose = musdBalance + 1e-9 >= debtNeeded && debtNeeded > 0;

  const preview = useMemo(() => {
    if (!trove || !price) return null;
    if (mode === "add" && btcN > 0) {
      const after = ratioAfterAddColl(trove, price, btcN);
      const next = { coll: trove.coll + btcN, debt: trove.debt };
      return { after, liq: liquidationPrice(next), band: band(after) };
    }
    if (mode === "repay" && repayN > 0) {
      const after = ratioAfterRepay(trove, price, repayN);
      const next = { coll: trove.coll, debt: Math.max(0, trove.debt - repayN) };
      return { after, liq: liquidationPrice(next), band: band(after) };
    }
    return null;
  }, [trove, price, mode, btcN, repayN]);

  if (!connected) {
    return (
      <div className="panel protect-panel" data-feature="protect-loan" aria-labelledby="protect-title">
        <div className="account-row">
          <h3 id="protect-title"><IconShield width={16} height={16} /> {t(lang, "protectTitle")}</h3>
        </div>
        <p className="btc-copy">Connect a wallet with a Mezo loan to see live ICR warnings and one-click protect actions.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="panel protect-panel" data-feature="protect-loan"><span className="skeleton" style={{ height: 80 }} /></div>;
  }

  if (!trove || r === undefined) {
    return (
      <div className="panel protect-panel" data-feature="protect-loan" aria-labelledby="protect-title">
        <div className="account-row">
          <h3 id="protect-title"><IconShield width={16} height={16} /> {t(lang, "protectTitle")}</h3>
          <span className="status">No loan</span>
        </div>
        <p className="btc-copy">No active Mezo trove on this wallet. Protect activates once you open a loan.</p>
      </div>
    );
  }

  const busy = addTx.busy || repayTx.busy || closeTx.busy;
  const warn = level === "watch" || level === "danger";

  return (
    <div className={`panel protect-panel band-${band(r)}`} data-feature="protect-loan" aria-labelledby="protect-title">
      <div className="account-row">
        <h3 id="protect-title"><IconShield width={16} height={16} /> {t(lang, "protectTitle")}</h3>
        <span className={`status ${warn ? "status-warn" : "status-ok"}`}>{BAND_COPY[band(r)]}</span>
      </div>
      <p className="btc-copy">{warn ? t(lang, "protectWarn") : t(lang, "protectSafe")}</p>
      <dl className="account-meta">
        <div><dt>ICR now</dt><dd className="tnum">{Math.round(r * 100)}%</dd></div>
        <div><dt>Liq price</dt><dd className="tnum">{usd(liquidationPrice(trove))}</dd></div>
        <div><dt>Comfort</dt><dd className="tnum">{Math.round(COMFORT * 100)}%</dd></div>
        <div><dt>Wallet MUSD</dt><dd className="tnum">{num(musdBalance)}</dd></div>
      </dl>

      <div className="seg" role="group" aria-label="Protect action">
        <button type="button" className={mode === "add" ? "on" : ""} aria-pressed={mode === "add"} onClick={() => setMode("add")}>
          <IconBitcoin width={15} height={15} /> {t(lang, "protectAdd")}
        </button>
        <button type="button" className={mode === "repay" ? "on" : ""} aria-pressed={mode === "repay"} onClick={() => setMode("repay")}>
          {t(lang, "protectRepay")}
        </button>
      </div>

      {mode === "add" ? (
        <form className="fund" onSubmit={(e) => {
          e.preventDefault();
          if (btcN > 0) void addTx.run(() => actions.addCollateral(btcAmt, trove));
        }}>
          <div className="field">
            <label htmlFor="protect-btc">BTC to add as collateral</label>
            <div className="input-wrap">
              <input id="protect-btc" inputMode="decimal" value={btcAmt} onChange={(e) => setBtcAmt(e.target.value)} autoComplete="off" />
              <span className="suffix">BTC</span>
            </div>
          </div>
          {preview && (
            <div className={`preview band-${preview.band}`}>
              <div><span>{t(lang, "protectPreview")} ICR</span><strong className="tnum">{Math.round(r * 100)}% → {Math.round(preview.after * 100)}%</strong></div>
              <div><span>Liq price</span><strong className="tnum">{usd(preview.liq)}</strong></div>
              <div><span>Band</span><strong>{BAND_COPY[preview.band]}</strong></div>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !(btcN > 0)}>
            {addTx.busy ? <span className="spinner" /> : t(lang, "protectAdd")}
          </button>
        </form>
      ) : (
        <form className="fund" onSubmit={(e) => {
          e.preventDefault();
          if (repayN > 0) void repayTx.run(() => actions.repayLoan(repayAmt, trove));
        }}>
          <div className="field">
            <label htmlFor="protect-repay">MUSD to repay</label>
            <div className="input-wrap">
              <input id="protect-repay" inputMode="decimal" value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} autoComplete="off" />
              <span className="suffix">MUSD</span>
            </div>
          </div>
          {preview && (
            <div className={`preview band-${preview.band}`}>
              <div><span>{t(lang, "protectPreview")} ICR</span><strong className="tnum">{Math.round(r * 100)}% → {Math.round(preview.after * 100)}%</strong></div>
              <div><span>Liq price</span><strong className="tnum">{usd(preview.liq)}</strong></div>
              <div><span>Band</span><strong>{BAND_COPY[preview.band]}</strong></div>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !(repayN > 0) || repayN > musdBalance + 1e-9}>
            {repayTx.busy ? <span className="spinner" /> : t(lang, "protectRepay")}
          </button>
          {repayN > musdBalance && <div className="form-error" role="alert">Not enough MUSD in this wallet.</div>}
        </form>
      )}

      {!canClose && (
        <div className="notice notice-warn" role="note" data-feature="close-need-musd">
          <span>{t(lang, "closeNeedMusd")} Need about {num(debtNeeded, 0)} MUSD; wallet has {num(musdBalance)}.</span>
        </div>
      )}

      <button
        type="button"
        className="btn btn-soft btn-block"
        disabled={busy}
        data-feature="close-trove"
        onClick={() => setCloseOpen(true)}
      >
        {closeTx.busy ? <span className="spinner" /> : t(lang, "protectClose")}
      </button>
      <p className="fund-note">Closing needs enough MUSD to cover the whole loan (min ~2,000 MUSD debt floor). Gas compensation is refunded on close.</p>
      {(addTx.hash || repayTx.hash || closeTx.hash) && (
        <a className="txline tnum" href={`https://explorer.test.mezo.org/tx/${addTx.hash || repayTx.hash || closeTx.hash}`} target="_blank" rel="noreferrer">
          tx: {(addTx.hash || repayTx.hash || closeTx.hash)!.slice(0, 10)}…
        </a>
      )}

      <ConfirmDialog
        open={closeOpen}
        title={t(lang, "closeConfirmTitle")}
        danger
        busy={closeTx.busy}
        confirmLabel={t(lang, "closeConfirm")}
        cancelLabel="Cancel"
        onCancel={() => setCloseOpen(false)}
        onConfirm={() => {
          if (!canClose) return;
          setCloseOpen(false);
          void closeTx.run(() => actions.closeLoan());
        }}
        body={
          <>
            <p>{t(lang, "closeConfirmBody")}</p>
            <dl className="account-meta">
              <div><dt>Debt</dt><dd className="tnum">{num(debtNeeded)} MUSD</dd></div>
              <div><dt>Wallet</dt><dd className="tnum">{num(musdBalance)} MUSD</dd></div>
              <div><dt>Collateral</dt><dd className="tnum">{num(trove.coll, 4)} BTC</dd></div>
            </dl>
            {!canClose && <p className="form-error" role="alert">{t(lang, "closeNeedMusd")}</p>}
          </>
        }
      />
    </div>
  );
}
