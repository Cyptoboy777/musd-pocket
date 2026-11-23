import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { decodeEventLog, formatUnits, type Hex } from "viem";
import { m } from "motion/react";
import { musdPocketAbi } from "../lib/abi";
import { MEZO, POCKET_ADDRESS, POCKET_V2, mezoTestnet } from "../lib/chains";
import { FACTS } from "../lib/facts";
import {
  borrowerOperationsAbi, closeCostWei, debtWeiFromEntire, maxRepayWei, priceFeedAbi, troveManagerAbi,
  useMezoActions, type MezoPosition,
} from "../lib/mezo";
import { AT_RISK, BAND_COPY, band, ratio, ratioAfterRepay } from "../lib/risk";
import { summarizeTesters, type PocketLog } from "../lib/testers";
import { useAsyncTx } from "../hooks/useAsyncTx";
import { txUrl } from "../hooks/useTxFeedback";
import { IconAlert, IconCheck, IconExternal, IconShield, IconUsers } from "./Icons";

const EXPLORER = mezoTestnet.blockExplorers.default.url;
const EXPLORER_API = "https://api.explorer.test.mezo.org/api/v2";
const SMUSD = FACTS.contracts.savingsVaultTestnet as `0x${string}`;
const EASE = [0.16, 1, 0.3, 1] as const;

const n18 = (v?: bigint) => (v === undefined ? 0 : Number(formatUnits(v, 18)));
const money = (v: number, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/* ───────────── Recovery Mode banner (system-wide, no wallet needed) ───────────── */

export function useSystemRisk() {
  const { data: price } = useReadContract({
    address: MEZO.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice", chainId: mezoTestnet.id,
    query: { refetchInterval: 60_000 },
  });
  const { data } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: MEZO.troveManager, abi: troveManagerAbi, functionName: "checkRecoveryMode", args: [price ?? 0n], chainId: mezoTestnet.id },
      { address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getTCR", args: [price ?? 0n], chainId: mezoTestnet.id },
      { address: MEZO.borrowerOperations, abi: borrowerOperationsAbi, functionName: "minNetDebt", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "totalInVault", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "earnAvailable", chainId: mezoTestnet.id },
    ],
    query: { enabled: price !== undefined, refetchInterval: 60_000 },
  });
  return {
    price: price as bigint | undefined,
    recoveryMode: data?.[0]?.result as boolean | undefined,
    tcr: data?.[1]?.result as bigint | undefined,
    minNetDebt: data?.[2]?.result as bigint | undefined,
    totalInVault: data?.[3]?.result as bigint | undefined,
    earnAvailable: data?.[4]?.result as boolean | undefined,
  };
}

export function RecoveryBanner({ on }: { on?: boolean }) {
  if (!on) return null;
  return (
    <div className="notice notice-warn rm-banner" role="alert" data-feature="recovery-mode-banner">
      <IconAlert width={18} height={18} />
      <span>
        <strong>Mezo is in Recovery Mode.</strong> The system as a whole is under 150% collateral, so MUSD Pocket has paused
        borrowing into goals and full loan closes. Deposits, withdrawals and fee-free emergency repays still work.
      </span>
    </div>
  );
}

/* ───────────── Live safety checks (aside panel) ───────────── */

export function RiskChecksPanel({ pos, connected }: { pos: MezoPosition; connected: boolean }) {
  const sys = useSystemRisk();
  const r = pos.trove && pos.price ? ratio(pos.trove, pos.price) : undefined;
  const rows: { label: string; value: ReactNode; ok?: boolean }[] = [
    {
      label: "Mezo system mode",
      value: sys.recoveryMode === undefined ? "Checking…" : sys.recoveryMode ? "Recovery Mode" : "Normal",
      ok: sys.recoveryMode === undefined ? undefined : !sys.recoveryMode,
    },
    { label: "System collateral (TCR)", value: sys.tcr ? `${Math.round(n18(sys.tcr) * 100)}%` : "—", ok: sys.tcr ? n18(sys.tcr) >= 1.5 : undefined },
    { label: "Borrow-into-goal floor", value: "150% after borrow, else reverts", ok: true },
    { label: "Smallest Mezo loan", value: sys.minNetDebt ? `${money(n18(sys.minNetDebt), 0)} MUSD net debt` : "—", ok: true },
    {
      label: "Your loan",
      value: !connected ? "Connect to check" : r === undefined ? "No open loan" : `${Math.round(r * 100)}% · ${BAND_COPY[band(r)]}`,
      ok: r === undefined ? undefined : r >= AT_RISK,
    },
    {
      label: "Parked in Savings Vault",
      value: sys.totalInVault !== undefined
        ? <a href={`${EXPLORER}/address/${SMUSD}`} target="_blank" rel="noreferrer">{money(n18(sys.totalInVault))} MUSD</a>
        : "—",
    },
  ];
  return (
    <div className="panel risk-panel" data-feature="risk-checks" aria-labelledby="risk-title">
      <div className="account-row">
        <h3 id="risk-title"><IconShield width={16} height={16} /> Live safety checks</h3>
        <span className="status status-ok"><i />Live</span>
      </div>
      <ul className="risk-list">
        {rows.map((row) => (
          <li key={row.label}>
            <span className={`risk-dot ${row.ok === undefined ? "" : row.ok ? "ok" : "bad"}`} aria-hidden="true" />
            <span className="risk-label">{row.label}</span>
            <span className="risk-value tnum">{row.value}</span>
          </li>
        ))}
      </ul>
      <p className="btc-copy faint">Recovery Mode, the 150% floor and the 1,800 MUSD minimum are also checked inside the contract, so a stale screen cannot push those through.</p>
    </div>
  );
}

/* ───────────── Earn row on a goal card ───────────── */

export function EarnRow({ goalId, balance, canWrite, active, onDone }: { goalId: bigint; balance: bigint; canWrite: boolean; active: boolean; onDone: () => void }) {
  const actions = useMezoActions();
  const { data, refetch } = useReadContract({
    address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "earnInfo", args: [goalId], chainId: mezoTestnet.id,
    query: { refetchInterval: 45_000 },
  });
  const { data: available } = useReadContract({ address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "earnAvailable", chainId: mezoTestnet.id });
  const [earning, inVault, pending, earned] = (data as readonly [boolean, bigint, bigint, bigint] | undefined) ?? [false, 0n, 0n, 0n];
  const tx = useAsyncTx(`earn-${goalId}`, earning ? "Earning switched off" : "Now earning in the Savings Vault");
  useEffect(() => { if (tx.success) { void refetch(); onDone(); } }, [tx.success]);
  if (!active || available === false) return null;
  const yieldNow = n18(pending) + n18(earned);
  return (
    <div className={`earn-row ${earning ? "is-on" : ""}`} data-feature="earn-mode">
      <div className="earn-copy">
        <strong>{earning ? "Earning while locked" : "Let this goal earn"}</strong>
        <span>
          {earning
            ? <>{money(n18(inVault))} MUSD in Mezo's MUSD Savings Vault · <span className="tnum">+{yieldNow.toFixed(4)} MUSD</span> yield so far</>
            : <>Park the balance in Mezo's MUSD Savings Vault (sMUSD). Rate varies with protocol fees; withdraw returns principal plus yield.</>}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={earning}
        aria-label={earning ? "Stop earning" : "Start earning"}
        className="switch"
        disabled={!canWrite || tx.busy || (!earning && balance === 0n && false)}
        onClick={() => void tx.run(() => actions.setEarn(goalId, !earning))}
      >
        {tx.busy ? <span className="spinner" /> : <span className="switch-knob" />}
      </button>
    </div>
  );
}

/* ───────────── Emergency repay / close from a goal ───────────── */

export function LoanShield({ goalId, balance, locked, pos, canWrite, onDone }: {
  goalId: bigint; balance: bigint; locked: boolean; pos: MezoPosition; canWrite: boolean; onDone: () => void;
}) {
  const { address } = useAccount();
  const sys = useSystemRisk();
  const actions = useMezoActions();
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const repay = useAsyncTx(`repay-${goalId}`, `Repaid ${amt || ""} MUSD of your loan from this goal`);
  const close = useAsyncTx(`close-${goalId}`, "Loan closed. Your BTC is back in your wallet");
  const { data: dc, refetch } = useReadContract({
    address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: address ? [address] : undefined,
    chainId: mezoTestnet.id, query: { enabled: !!address && !!pos.trove },
  });
  const { data: feeBps } = useReadContract({ address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "goalEarlyFeeBps", args: [goalId], chainId: mezoTestnet.id });
  useEffect(() => { if (repay.success || close.success) { void refetch(); pos.refetch(); onDone(); } }, [repay.success, close.success]);

  if (!pos.trove || !pos.price) return null;
  const debtWei = dc ? debtWeiFromEntire(dc as readonly bigint[]) : undefined;
  const maxRepay = debtWei !== undefined && sys.minNetDebt !== undefined ? maxRepayWei(debtWei, sys.minNetDebt) : undefined;
  const closeCost = debtWei !== undefined ? closeCostWei(debtWei) : undefined;
  const r = ratio(pos.trove, pos.price);
  const atRisk = r < AT_RISK || !!sys.recoveryMode;
  const free = !locked || atRisk;
  const bps = Number(feeBps ?? 200);
  const feeOf = (x: number) => (free ? 0 : (x * bps) / 10_000);
  const a = Number(amt) || 0;
  const after = a > 0 ? ratioAfterRepay(pos.trove, pos.price, a) : undefined;
  const bal = n18(balance);
  const maxN = maxRepay !== undefined ? n18(maxRepay) : 0;
  const limit = Math.max(0, Math.min(maxN, bal / (1 + (free ? 0 : bps / 10_000))));
  const tooMuch = a > limit + 1e-9;
  const canClose = closeCost !== undefined && !sys.recoveryMode && bal >= n18(closeCost) + feeOf(n18(closeCost));
  const busy = repay.busy || close.busy;

  return (
    <>
      <div className={`shield-row band-${band(r)}`} data-feature="loan-health">
        <div>
          <span className="shield-k">Loan health</span>
          <strong className="tnum">{Math.round(r * 100)}% · {BAND_COPY[band(r)]}</strong>
        </div>
        <button type="button" className="btn btn-soft" disabled={!canWrite || balance === 0n} onClick={() => setOpen(true)} data-feature="emergency-repay">
          <IconShield width={15} height={15} /> Protect my loan
        </button>
      </div>
      {open && (
        <div className="confirm-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <m.div
            className="confirm-dialog panel shield-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`shield-${goalId}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <h3 id={`shield-${goalId}`}>Use this goal to protect your loan</h3>
            <p className="shield-lede">
              MUSD from this goal pays down your own Mezo loan directly. You sign Mezo's repay message; the goal's MUSD is burned against your debt and
              never passes through your wallet. This cannot be undone, and the goal gets smaller by the amount you repay.
            </p>
            <dl className="account-meta">
              <div><dt>In this goal</dt><dd className="tnum">{money(bal)} MUSD</dd></div>
              <div><dt>Loan ratio now</dt><dd className="tnum">{Math.round(r * 100)}%</dd></div>
              <div><dt>Most you can repay</dt><dd className="tnum">{maxRepay === undefined ? "Checking…" : `${money(limit)} MUSD`}</dd></div>
              <div><dt>Fee on this repay</dt><dd>{free ? "None" : `${(bps / 100).toFixed(2)}% (loan is healthy and goal is locked)`}</dd></div>
            </dl>
            <p className="fund-note">
              Mezo keeps every loan at {sys.minNetDebt ? money(n18(sys.minNetDebt), 0) : "1,800"} MUSD or more, so a partial repay stops there. Repaying is free when
              your loan is under {Math.round(AT_RISK * 100)}%, when Mezo is in Recovery Mode, or once the goal has unlocked.
            </p>
            <form className="fund" onSubmit={(e) => { e.preventDefault(); if (a > 0 && !tooMuch) void repay.run(() => actions.emergencyRepay(goalId, amt)); }}>
              <div className="field">
                <label htmlFor={`rep-${goalId}`}>Repay from this goal</label>
                <div className="input-wrap">
                  <input id={`rep-${goalId}`} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={limit > 0 ? `up to ${money(limit)}` : "0"} value={amt} onChange={(e) => setAmt(e.target.value)} aria-invalid={tooMuch} />
                  <button type="button" className="suffix link-btn" onClick={() => setAmt(limit > 0 ? (Math.floor(limit * 100) / 100).toString() : "")}>Max</button>
                </div>
              </div>
              {after !== undefined && !tooMuch && (
                <div className={`preview band-${band(after)}`}>
                  <div><span>Loan ratio</span><strong className="tnum">{Math.round(r * 100)}% → {Number.isFinite(after) ? `${Math.round(after * 100)}%` : "No debt"}</strong></div>
                  <div><span>Fee</span><strong className="tnum">{money(feeOf(a))} MUSD</strong></div>
                  <div><span>Goal after</span><strong className="tnum">{money(Math.max(0, bal - a - feeOf(a)))} MUSD</strong></div>
                </div>
              )}
              {tooMuch && <p className="form-error" role="alert">{maxN <= 0 ? "Your loan is already at Mezo's minimum. Close it instead, or add BTC collateral." : `That is more than this goal can repay right now. The most is ${money(limit)} MUSD.`}</p>}
              <div className="shield-actions">
                <button type="submit" className="btn btn-primary" disabled={!canWrite || busy || !(a > 0) || tooMuch}>
                  {repay.busy && <span className="spinner" />} Repay {a > 0 ? `${money(a)} MUSD` : ""}
                </button>
                {canClose && (
                  <button type="button" className="btn btn-danger" disabled={!canWrite || busy} onClick={() => void close.run(() => actions.emergencyClose(goalId))}>
                    {close.busy && <span className="spinner" />} Close the whole loan ({money(n18(closeCost))} MUSD)
                  </button>
                )}
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Not now</button>
              </div>
              {(repay.hash || close.hash) && (
                <a className="link-out" href={txUrl((repay.hash || close.hash)!)} target="_blank" rel="noreferrer">View transaction <IconExternal width={13} height={13} /></a>
              )}
            </form>
          </m.div>
        </div>
      )}
    </>
  );
}

/* ───────────── Testers: real outside wallets, read live ───────────── */

type ExplorerLog = { topics: (Hex | null)[]; data: Hex; transaction_hash: Hex; block_number: number };

async function explorerLogs(address: string, signal: AbortSignal): Promise<ExplorerLog[]> {
  const out: ExplorerLog[] = [];
  let qs = "";
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`${EXPLORER_API}/addresses/${address}/logs${qs}`, { signal });
    if (!res.ok) throw new Error("explorer");
    const body = (await res.json()) as { items: ExplorerLog[]; next_page_params: Record<string, string | number> | null };
    out.push(...body.items);
    if (!body.next_page_params) break;
    qs = "?" + new URLSearchParams(Object.entries(body.next_page_params).map(([k, v]) => [k, String(v)])).toString();
  }
  return out;
}

function toPocketLogs(raw: ExplorerLog[], contract: "v2" | "v3"): PocketLog[] {
  const out: PocketLog[] = [];
  for (const l of raw) {
    try {
      const ev = decodeEventLog({ abi: musdPocketAbi, topics: l.topics.filter(Boolean) as [Hex, ...Hex[]], data: l.data });
      const base = { contract, txHash: l.transaction_hash, blockNumber: BigInt(l.block_number) };
      const args = ev.args as Record<string, unknown>;
      if (ev.eventName === "GoalCreated") out.push({ ...base, kind: "GoalCreated", goalId: args.goalId as bigint, who: args.owner as `0x${string}` });
      if (ev.eventName === "Deposited") out.push({ ...base, kind: "Deposited", goalId: args.goalId as bigint, who: args.from as `0x${string}`, amount: args.amount as bigint });
      if (ev.eventName === "BorrowedToGoal") out.push({ ...base, kind: "BorrowedToGoal", goalId: args.goalId as bigint, who: args.borrower as `0x${string}`, amount: args.amount as bigint });
    } catch { /* other events */ }
  }
  // BorrowedToGoal also emits Deposited for the same tx; count the borrow once.
  const borrowTx = new Set(out.filter((x) => x.kind === "BorrowedToGoal").map((x) => x.txHash));
  return out.filter((x) => !(x.kind === "Deposited" && borrowTx.has(x.txHash)));
}

export function TestersSection() {
  const [logs, setLogs] = useState<PocketLog[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([explorerLogs(POCKET_ADDRESS, ctl.signal), explorerLogs(POCKET_V2, ctl.signal)])
      .then(([v3, v2]) => setLogs([...toPocketLogs(v3, "v3"), ...toPocketLogs(v2, "v2")]))
      .catch(() => { if (!ctl.signal.aborted) setFailed(true); });
    return () => ctl.abort();
  }, []);
  const s = useMemo(() => (logs ? summarizeTesters(logs) : null), [logs]);
  const label = (r: PocketLog & { chipIn: boolean }) =>
    r.kind === "GoalCreated" ? "Created a goal" : r.kind === "BorrowedToGoal" ? "Borrowed into a goal" : r.chipIn ? "Chipped in to a shared goal" : "Deposited";

  return (
    <section id="testers" className="testers" aria-labelledby="testers-title">
      <div className="section-head">
        <h2 id="testers-title">People testing it</h2>
        <p>Every row is an on-chain event from a wallet that is not ours, read from the Mezo explorer when this page loads. Builder wallets are left out.</p>
      </div>
      <div className="testers-wrap">
        <div className="testers-stats">
          {[
            { k: "Outside wallets", v: s ? s.outsideWallets.toString() : "—" },
            { k: "Deposits and borrows", v: s ? s.outsideDeposits.toString() : "—" },
            { k: "Chip-ins to shared goals", v: s ? s.outsideChipIns.toString() : "—" },
            { k: "MUSD saved by testers", v: s ? money(n18(s.outsideMusd)) : "—" },
          ].map((x) => (
            <div key={x.k} className="panel tester-stat"><span>{x.k}</span><strong className="tnum">{x.v}</strong></div>
          ))}
        </div>
        <div className="panel testers-list">
          {failed && <p className="btc-copy">The explorer did not answer just now. Refresh in a minute.</p>}
          {!failed && !s && <p className="btc-copy"><span className="spinner" /> Reading the chain…</p>}
          {s && s.rows.length === 0 && (
            <p className="btc-copy">No outside activity yet. Be the first: create a shared goal and send the invite link to a friend.</p>
          )}
          {s && s.rows.length > 0 && (
            <ol className="tester-rows">
              {s.rows.slice(0, 25).map((r) => (
                <li key={`${r.txHash}-${r.kind}`}>
                  <IconUsers width={15} height={15} />
                  <span className="mono-ish">{short(r.who)}</span>
                  <span>{label(r)}</span>
                  <span className="tnum">{r.amount !== undefined ? `${money(n18(r.amount))} MUSD` : `goal #${r.goalId}`}</span>
                  <span className="faint">{r.contract}</span>
                  <a href={`${EXPLORER}/tx/${r.txHash}`} target="_blank" rel="noreferrer" aria-label="View transaction"><IconExternal width={13} height={13} /></a>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Team ───────────── */

export function TeamSection() {
  return (
    <section id="team" className="team" aria-labelledby="team-title">
      <div className="section-head">
        <h2 id="team-title">Who builds it</h2>
        <p>A solo builder, shipping in public on Mezo since Wave 1.</p>
      </div>
      <div className="team-wrap">
        <div className="panel team-card">
          <div className="team-mark" aria-hidden="true">CB</div>
          <div>
            <h3>Crypto boy</h3>
            <p className="team-role">Founder · smart contracts, product and design</p>
            <p className="btc-copy">Wrote the Pocket contracts, the Mezo integration and this app. Answers tester questions on AKINDO.</p>
            <div className="team-links">
              <a className="link-out" href="https://app.akindo.io/communities/7mNwdW6lMHBpD8vA/products/lrkJw68jAfL634ne" target="_blank" rel="noreferrer">AKINDO project page (@Cryptoboy_777) <IconExternal width={13} height={13} /></a>
              <a className="link-out" href={`${EXPLORER}/address/${POCKET_ADDRESS}`} target="_blank" rel="noreferrer">Verified contract <IconExternal width={13} height={13} /></a>
            </div>
          </div>
        </div>
        <div className="panel team-card team-checks">
          <h3>What keeps it honest</h3>
          <ul>
            <li><IconCheck width={15} height={15} /> Contracts verified on the Mezo explorer and on Sourcify</li>
            <li><IconCheck width={15} height={15} /> Admin actions wait 2 days in a public timelock</li>
            <li><IconCheck width={15} height={15} /> The admin can never touch goal balances or earned yield</li>
            <li><IconCheck width={15} height={15} /> Numbers on this page come from the chain, not from us</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
