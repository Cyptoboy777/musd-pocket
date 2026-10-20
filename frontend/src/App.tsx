import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { formatUnits, parseUnits, isAddress, zeroAddress } from "viem";
import { AnimatePresence, m } from "motion/react";
import { musdPocketAbi, erc20Abi } from "./lib/abi";
import { MUSD_ADDRESS, POCKET_ADDRESS, mezoTestnet } from "./lib/chains";
import { LogoMark, Wordmark } from "./components/Logo";
import { Guilloche } from "./components/Guilloche";
import { useCountUp } from "./hooks/useCountUp";
import { txUrl, useTxFeedback } from "./hooks/useTxFeedback";
import {
  IconBitcoin, IconCheck, IconClock, IconCode, IconCopy, IconExternal, IconLock,
  IconDeposit, IconPlus, IconSend, IconShield, IconUnlock, IconUsers,
} from "./components/Icons";

type Tab = "goals" | "save" | "send";
const TABS: { id: Tab; label: string }[] = [
  { id: "goals", label: "Pockets" },
  { id: "save", label: "New goal" },
  { id: "send", label: "Send" },
];
const EXPLORER = mezoTestnet.blockExplorers.default.url;
const EASE = [0.16, 1, 0.3, 1] as const;

function toNum(n: bigint | undefined) {
  return n === undefined ? 0 : Number(formatUnits(n, 18));
}
function fmtNum(v: number, digits = 2) {
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmt(n: bigint | undefined, digits = 2) {
  if (n === undefined) return "—";
  return fmtNum(toNum(n), digits);
}
function short(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/* ───────────────────────── App ───────────────────────── */

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [tab, setTab] = useState<Tab>("goals");
  const deployed = POCKET_ADDRESS !== zeroAddress;

  const { data: musdBal, isLoading: balLoading } = useReadContract({
    address: MUSD_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: goalIds, isLoading: goalsLoading } = useReadContract({
    address: POCKET_ADDRESS,
    abi: musdPocketAbi,
    functionName: "goalsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && deployed },
  });

  const wrongNetwork = isConnected && chainId !== mezoTestnet.id;
  const ids = (goalIds as bigint[] | undefined) || [];
  const balance = isConnected ? toNum(musdBal as bigint | undefined) : 0;

  const go = (t: Tab) => {
    setTab(t);
    document.getElementById("app")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <header className="nav">
        <div className="nav-inner">
          <a href="#top" className="nav-brand" aria-label="MUSD Pocket home">
            <Wordmark />
          </a>
          <nav className="nav-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#app">Pockets</a>
            <a href={`${EXPLORER}/address/${POCKET_ADDRESS}`} target="_blank" rel="noreferrer">
              Contract <IconExternal width={14} height={14} />
            </a>
          </nav>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </div>
      </header>

      <main id="top">
        <Hero balance={balance} loading={isConnected && balLoading} connected={isConnected} goals={ids.length} onStart={() => go("save")} onView={() => go("goals")} />
        <HowItWorks />

        <section id="app" className="app-section" aria-labelledby="app-title">
          <div className="section-head">
            <h2 id="app-title">Your pockets</h2>
            <p>Every pocket is a goal with a date. Money in it stays put until then.</p>
          </div>

          <div className="app-grid">
            <aside className="account">
              <AccountPanel balance={balance} loading={isConnected && balLoading} connected={isConnected} address={address} goals={ids.length} wrongNetwork={wrongNetwork} />
            </aside>

            <div className="workspace">
              {!deployed && (
                <div className="notice" role="note">
                  <IconInfo2 />
                  <span>
                    Contract not deployed yet. Fund the deployer with testnet BTC from{" "}
                    <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">faucet.test.mezo.org</a>, then redeploy. UI + ABIs are ready for Mezo testnet MUSD.
                  </span>
                </div>
              )}
              {wrongNetwork && (
                <div className="notice notice-warn" role="alert">
                  <IconInfo2 />
                  <span>Switch your wallet to <strong>Mezo Testnet (chain 31611)</strong> to continue.</span>
                </div>
              )}

              <Tabs tab={tab} setTab={setTab} />

              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={tab}
                  id={`panel-${tab}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${tab}`}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14 } }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  {tab === "goals" && (
                    <GoalsPanel goalIds={ids} deployed={deployed} connected={isConnected} loading={isConnected && goalsLoading} onCreate={() => setTab("save")} />
                  )}
                  {tab === "save" && <SavePanel deployed={deployed} />}
                  {tab === "send" && <SendPanel deployed={deployed} />}
                </m.div>
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Wordmark />
            <p>Bitcoin-backed savings goals on Mezo. Built for the AKINDO Mezo Buildathon, Access &amp; Distribution track.</p>
          </div>
          <dl className="footer-addrs">
            <div><dt>MUSDPocket</dt><dd><Addr value={POCKET_ADDRESS} /></dd></div>
            <div><dt>MUSD token</dt><dd><Addr value={MUSD_ADDRESS} /></dd></div>
            <div><dt>Network</dt><dd>Mezo Testnet, chain 31611</dd></div>
          </dl>
          <div className="footer-links">
            <a href={EXPLORER} target="_blank" rel="noreferrer">Explorer <IconExternal width={14} height={14} /></a>
            <a href="https://github.com/Cyptoboy777/musd-pocket" target="_blank" rel="noreferrer">Source <IconExternal width={14} height={14} /></a>
            <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">Faucet <IconExternal width={14} height={14} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function IconInfo2() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="notice-icon">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" />
    </svg>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ balance, loading, connected, goals, onStart, onView }: { balance: number; loading: boolean; connected: boolean; goals: number; onStart: () => void; onView: () => void }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-light" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <m.p className="hero-tag" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}>
            <span className="live-dot" aria-hidden="true" /> Live on Mezo testnet
          </m.p>
          <h1 id="hero-title" className="hero-title">
            {["Money that keeps", "its promises."].map((line, i) => (
              <span className="line-mask" key={line}>
                <m.span className="line" initial={{ y: "105%" }} animate={{ y: "0%" }} transition={{ duration: 0.9, ease: EASE, delay: 0.12 + i * 0.09 }}>
                  {line}
                </m.span>
              </span>
            ))}
          </h1>
          <m.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}>
            Lock MUSD, the Bitcoin-backed dollar on Mezo, into goals with a date: an emergency fund, a trip, a home deposit. Withdraw when it unlocks, or early for a 2% fee.
          </m.p>
          <m.div className="hero-cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}>
            <button className="btn btn-primary btn-lg" onClick={onStart}>
              <IconPlus /> Create a goal
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onView}>
              View my pockets
            </button>
          </m.div>
          <m.ul className="hero-facts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }}>
            <li><IconBitcoin /> Backed by Bitcoin</li>
            <li><IconShield /> Self-custody vault</li>
            <li><IconCode /> Open source, 11/11 tests</li>
          </m.ul>
        </div>

        <m.div className="hero-stage" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}>
          <Guilloche className="hero-rosette" />
          <Note balance={balance} loading={loading} connected={connected} goals={goals} />
          <m.div className="float-pocket" aria-hidden="true" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}>
            <ProgressRing pct={62} />
            <div>
              <span className="float-label">Example pocket</span>
              <strong>Emergency fund</strong>
              <span className="float-meta tnum">620 of 1,000 MUSD, 41 days left</span>
            </div>
          </m.div>
          <m.div className="float-lock" aria-hidden="true" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 1.05 }}>
            <IconLock width={16} height={16} /> Locked until 14 Mar
          </m.div>
        </m.div>
      </div>
    </section>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="ring">
      <circle cx="26" cy="26" r={r} className="ring-track" />
      <circle cx="26" cy="26" r={r} className="ring-fill" strokeDasharray={c} style={{ strokeDashoffset: c * (1 - pct / 100) } as CSSProperties} />
      <text x="26" y="30" textAnchor="middle" className="ring-text">{pct}%</text>
    </svg>
  );
}

function Note({ balance, loading, connected, goals }: { balance: number; loading: boolean; connected: boolean; goals: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useCountUp(balance, 1100);
  const [whole, frac] = fmtNum(shown).split(".");

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - py) * 7}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * 9}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="note-wrap" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="note" ref={ref}>
        <Guilloche className="note-engraving" />
        <div className="note-sheen" aria-hidden="true" />
        <div className="note-top">
          <LogoMark size={34} />
          <span className="note-chip">On Mezo</span>
        </div>
        <div className="note-body">
          <span className="note-label">{connected ? "Wallet balance" : "Your balance"}</span>
          <div className="note-amount" aria-live="polite">
            {loading ? (
              <span className="skeleton skeleton-amount" />
            ) : (
              <>
                <span className="tnum">{whole}</span>
                <span className="note-frac tnum">.{frac}</span>
                <span className="note-unit">MUSD</span>
              </>
            )}
          </div>
          <span className="note-hint">
            {connected ? `${goals} ${goals === 1 ? "pocket" : "pockets"} open` : "Connect a wallet to see your balance"}
          </span>
        </div>
        <div className="note-foot">
          <span className="note-serial tnum">{short(POCKET_ADDRESS)}</span>
          <span className="note-serial">Gas paid in BTC</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    { icon: <IconPlus />, title: "Name a goal", body: "Set a target in MUSD and an unlock date between 1 day and 2 years." },
    { icon: <IconDeposit />, title: "Fill the pocket", body: "Approve and deposit MUSD whenever you like. Share a goal so others can chip in." },
    { icon: <IconUnlock />, title: "Unlock on time", body: "Withdraw everything on the date. Need it sooner? Break early for a 2% fee." },
  ];
  return (
    <section id="how" className="how" aria-labelledby="how-title">
      <div className="section-head">
        <h2 id="how-title">Three steps, one promise</h2>
        <p>A term deposit you hold yourself, settled in a Bitcoin-backed dollar.</p>
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <m.li
            key={s.title}
            className="step"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
          >
            <span className="step-num tnum" aria-hidden="true">{i + 1}</span>
            <span className="step-icon">{s.icon}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </m.li>
        ))}
      </ol>
    </section>
  );
}

/* ───────────────────────── Account ───────────────────────── */

function AccountPanel({ balance, loading, connected, address, goals, wrongNetwork }: { balance: number; loading: boolean; connected: boolean; address?: string; goals: number; wrongNetwork: boolean }) {
  const shown = useCountUp(balance, 900);
  return (
    <div className="panel account-panel">
      <div className="account-row">
        <span className="muted">MUSD balance</span>
        <span className={`status ${connected ? (wrongNetwork ? "status-warn" : "status-ok") : ""}`}>
          <i aria-hidden="true" />
          {connected ? (wrongNetwork ? "Wrong network" : "Mezo Testnet") : "Not connected"}
        </span>
      </div>
      <div className="account-amount">
        {loading ? <span className="skeleton skeleton-amount-sm" /> : (<><span className="tnum">{fmtNum(shown)}</span><small>MUSD</small></>)}
      </div>
      <dl className="account-meta">
        <div><dt>Wallet</dt><dd className="tnum">{connected ? short(address) : "—"}</dd></div>
        <div><dt>Pockets</dt><dd className="tnum">{connected ? goals : "—"}</dd></div>
        <div><dt>Gas</dt><dd>BTC</dd></div>
        <div><dt>Early exit fee</dt><dd className="tnum">2%</dd></div>
      </dl>
      {!connected && (
        <div className="account-connect"><ConnectCta /></div>
      )}
    </div>
  );
}

/* ───────────────────────── Tabs ───────────────────────── */

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const idx = TABS.findIndex((t) => t.id === tab);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (idx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label="Pocket actions" onKeyDown={onKey} style={{ "--i": idx, "--n": TABS.length } as CSSProperties}>
      <span className="tabs-indicator" aria-hidden="true" />
      {TABS.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          id={`tab-${t.id}`}
          role="tab"
          aria-selected={tab === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={tab === t.id ? 0 : -1}
          className={`tab ${tab === t.id ? "active" : ""}`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Goals ───────────────────────── */

const EXAMPLES = [
  { name: "Emergency fund", target: "1,000", days: 90 },
  { name: "Travel", target: "600", days: 120 },
  { name: "Home deposit", target: "5,000", days: 365 },
];

function GoalsPanel({ goalIds, deployed, connected, loading, onCreate }: { goalIds: bigint[]; deployed: boolean; connected: boolean; loading: boolean; onCreate: () => void }) {
  if (!deployed) {
    return <EmptyState title="Pockets open after deploy" body="Once the contract is live you can create goals like an Emergency fund, Travel or a Home deposit." />;
  }
  if (!connected) {
    return (
      <div className="empty">
        <div className="empty-copy">
          <h3>Connect a wallet to see your pockets</h3>
          <p>Each pocket is a goal with a target and an unlock date. Here are a few people start with.</p>
        </div>
        <ul className="examples" aria-label="Example goals">
          {EXAMPLES.map((e, i) => (
            <li key={e.name} className="example" style={{ "--d": `${i * 60}ms` } as CSSProperties}>
              <span className="example-name">{e.name}</span>
              <span className="example-meta tnum">{e.target} MUSD</span>
              <span className="bar"><i style={{ width: `${[38, 62, 18][i]}%` }} /></span>
              <span className="example-meta"><IconClock width={14} height={14} /> {e.days}-day lock</span>
            </li>
          ))}
        </ul>
        <div className="empty-cta"><ConnectCta label="Connect wallet to start" /></div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="goal-list">
        {[0, 1].map((i) => <GoalSkeleton key={i} />)}
      </div>
    );
  }
  if (!goalIds.length) {
    return (
      <EmptyState
        title="No pockets yet"
        body="Create your first goal: pick a name, a target and an unlock date. It takes one transaction."
        action={<button className="btn btn-primary" onClick={onCreate}><IconPlus /> Create a goal</button>}
      />
    );
  }
  return (
    <div className="goal-list">
      {goalIds.map((id, i) => (
        <GoalCard key={id.toString()} goalId={id} index={i} />
      ))}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty empty-simple">
      <div className="empty-mark" aria-hidden="true"><LogoMark size={44} mono /></div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function GoalSkeleton() {
  return (
    <div className="panel goal goal-skeleton" aria-hidden="true">
      <div className="goal-head">
        <div style={{ flex: 1 }}>
          <span className="skeleton" style={{ width: "42%", height: 22 }} />
          <span className="skeleton" style={{ width: "64%", height: 14, marginTop: 10 }} />
        </div>
        <span className="skeleton" style={{ width: 72, height: 26, borderRadius: 999 }} />
      </div>
      <span className="skeleton" style={{ width: "100%", height: 8, borderRadius: 999 }} />
      <span className="skeleton" style={{ width: "100%", height: 48 }} />
    </div>
  );
}

function GoalCard({ goalId, index }: { goalId: bigint; index: number }) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { data, isLoading } = useReadContract({
    address: POCKET_ADDRESS,
    abi: musdPocketAbi,
    functionName: "getGoal",
    args: [goalId],
  });
  const { data: progress } = useReadContract({
    address: POCKET_ADDRESS,
    abi: musdPocketAbi,
    functionName: "progressBps",
    args: [goalId],
  });
  const [addAmt, setAddAmt] = useState("");
  const [lastAction, setLastAction] = useState("Done");

  useTxFeedback({ key: `goal-${goalId}`, isPending, hash, confirming, success: isSuccess, error, doneTitle: lastAction });

  if (isLoading) return <GoalSkeleton />;
  if (!data) return null;
  const name = data[1];
  const target = data[2];
  const balance = data[3];
  const unlockTime = data[4];
  const active = data[5];
  const isFamily = data[6];
  if (!active && balance === 0n) return null;

  const unlock = new Date(Number(unlockTime) * 1000);
  const locked = Date.now() / 1000 < Number(unlockTime);
  const pct = Math.min(100, Number(progress || 0n) / 100);
  const daysLeft = Math.max(0, Math.ceil((Number(unlockTime) - Date.now() / 1000) / 86400));
  const busy = isPending || confirming;

  async function approveAndDeposit() {
    if (!addAmt || !address) return;
    const amount = parseUnits(addAmt, 18);
    setLastAction("Approved. Now deposit.");
    writeContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [POCKET_ADDRESS, amount],
    });
    // user confirms second tx via Deposit button after approve
  }

  function deposit() {
    if (!addAmt) return;
    setLastAction(`Deposited ${addAmt} MUSD`);
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: "deposit",
      args: [goalId, parseUnits(addAmt, 18)],
    });
  }

  function withdraw() {
    setLastAction(locked ? "Withdrawn early" : "Withdrawn");
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: locked ? "earlyWithdraw" : "withdraw",
      args: [goalId],
    });
  }

  return (
    <m.article
      className="panel goal"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index, 5) * 0.05 }}
    >
      <div className="goal-head">
        <div>
          <h3 className="goal-name">{name}</h3>
          <div className="goal-meta">
            <span className="tnum">{fmt(balance)} of {fmt(target)} MUSD</span>
            {isFamily && <span className="tag"><IconUsers width={14} height={14} /> Shared</span>}
          </div>
        </div>
        <span className={`badge ${locked ? "badge-lock" : "badge-ready"}`}>
          {locked ? <IconLock width={14} height={14} /> : <IconUnlock width={14} height={14} />}
          {locked ? `${daysLeft}d left` : "Unlocked"}
        </span>
      </div>

      <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${name} progress`}>
        <div className="bar bar-lg"><m.i initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={{ duration: 1, ease: EASE, delay: 0.15 }} /></div>
        <div className="progress-legend">
          <span className="tnum">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
          <span>Unlocks {fmtDate(unlock)}</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`add-${goalId}`}>Add MUSD to this goal</label>
        <div className="input-wrap">
          <input id={`add-${goalId}`} inputMode="decimal" autoComplete="off" placeholder="e.g. 100" value={addAmt} onChange={(e) => setAddAmt(e.target.value)} />
          <span className="suffix">MUSD</span>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost" disabled={busy} onClick={approveAndDeposit}>Approve</button>
        <button className="btn btn-primary" disabled={busy} onClick={deposit}>{busy ? <span className="spinner" /> : null}Deposit</button>
      </div>
      <button className={`btn btn-block ${locked ? "btn-danger" : "btn-soft"}`} disabled={busy || balance === 0n} onClick={withdraw}>
        {locked ? "Early withdraw (2% fee)" : "Withdraw unlocked"}
      </button>
      {hash && <TxLine hash={hash} />}
    </m.article>
  );
}

function TxLine({ hash }: { hash: string }) {
  return (
    <a className="txline tnum" href={txUrl(hash)} target="_blank" rel="noreferrer">
      tx: {hash.slice(0, 10)}…{hash.slice(-8)} <IconExternal width={13} height={13} />
    </a>
  );
}

/* ───────────────────────── Save ───────────────────────── */

const PRESETS = [
  { name: "Emergency fund", target: "1000", days: "90" },
  { name: "Travel", target: "600", days: "120" },
  { name: "New laptop", target: "1500", days: "60" },
  { name: "Rent buffer", target: "800", days: "30" },
  { name: "Home deposit", target: "5000", days: "365" },
];

function SavePanel({ deployed }: { deployed: boolean }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const [name, setName] = useState("Emergency fund");
  const [target, setTarget] = useState("1000");
  const [days, setDays] = useState("30");
  const [family, setFamily] = useState(false);

  useTxFeedback({ key: "save", isPending, hash, confirming, success: isSuccess, error, doneTitle: `Goal created: ${name}` });

  const unlockPreview = useMemo(() => {
    const d = Number(days) || 0;
    return fmtDate(new Date(Date.now() + d * 86400000));
  }, [days]);

  function create() {
    if (!deployed) return;
    const unlock = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: "createGoal",
      args: [name, parseUnits(target || "0", 18), unlock, family],
    });
  }

  const busy = isPending || confirming;

  return (
    <form className="panel form" onSubmit={(e) => { e.preventDefault(); create(); }}>
      <div className="form-head">
        <h3>New savings goal</h3>
        <p>Lock MUSD until a date you choose. Shared goals let family or friends chip in.</p>
      </div>
      <div className="presets" role="group" aria-label="Quick start">
        {PRESETS.map((p) => (
          <button type="button" key={p.name} className={`chip ${name === p.name ? "chip-on" : ""}`} aria-pressed={name === p.name} onClick={() => { setName(p.name); setTarget(p.target); setDays(p.days); }}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="g-name">Goal name</label>
        <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} autoComplete="off" />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="g-target">Target</label>
          <div className="input-wrap">
            <input id="g-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} autoComplete="off" />
            <span className="suffix">MUSD</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="g-days">Lock (min 1 day)</label>
          <div className="input-wrap">
            <input id="g-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} autoComplete="off" />
            <span className="suffix">days</span>
          </div>
        </div>
      </div>
      <label className="switch">
        <input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} />
        <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
        <span className="switch-copy">
          <strong>Shared goal</strong>
          <span>Invite family or friends to deposit later</span>
        </span>
      </label>
      <div className="summary">
        <IconClock width={16} height={16} />
        <span>Unlocks around <strong>{unlockPreview}</strong></span>
      </div>
      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={!deployed || busy}>
        {busy ? (<><span className="spinner" /> Confirm in wallet…</>) : (<><IconCheck /> Create goal</>)}
      </button>
      {hash && <TxLine hash={hash} />}
      {error && <div className="form-error" role="alert">{error.message.split("\n")[0]}</div>}
    </form>
  );
}

/* ───────────────────────── Send ───────────────────────── */

function SendPanel({ deployed }: { deployed: boolean }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("50");
  const [memo, setMemo] = useState("Rent buffer");
  const [step, setStep] = useState<"approve" | "send">("approve");

  useTxFeedback({ key: "send", isPending, hash, confirming, success: isSuccess, error, doneTitle: step === "approve" ? "Approved. Now send." : `Sent ${amount} MUSD` });

  function approve() {
    if (!isAddress(to) || !amount) return;
    setStep("approve");
    writeContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [POCKET_ADDRESS, parseUnits(amount, 18)],
    });
  }

  function send() {
    if (!deployed || !isAddress(to)) return;
    setStep("send");
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: "sendRemittance",
      args: [to as `0x${string}`, parseUnits(amount, 18), memo],
    });
  }

  const busy = isPending || confirming;
  const badAddr = to.length > 0 && !isAddress(to);

  return (
    <form className="panel form" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="form-head">
        <h3>Send MUSD</h3>
        <p>Pay anyone with a note that lives on-chain, so both sides know what it was for.</p>
      </div>
      <div className="field">
        <label htmlFor="s-to">Recipient address</label>
        <input id="s-to" placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value.trim())} spellCheck={false} autoComplete="off" aria-invalid={badAddr} aria-describedby={badAddr ? "s-to-err" : undefined} />
        {badAddr && <span id="s-to-err" className="field-error">That doesn't look like a valid 0x address.</span>}
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="s-amt">Amount</label>
          <div className="input-wrap">
            <input id="s-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
            <span className="suffix">MUSD</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-memo">Memo</label>
          <input id="s-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={96} autoComplete="off" />
        </div>
      </div>
      <ol className="send-steps" aria-label="Two transactions">
        <li className={step === "send" && isSuccess ? "done" : ""}><span className="tnum">1</span> Approve MUSD</li>
        <li><span className="tnum">2</span> Send with memo</li>
      </ol>
      <div className="btn-row">
        <button type="button" className="btn btn-ghost btn-lg" disabled={!deployed || busy} onClick={approve}>Approve</button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={!deployed || busy || !isAddress(to)}>
          {busy ? <span className="spinner" /> : <IconSend />} Send MUSD
        </button>
      </div>
      {hash && <TxLine hash={hash} />}
      {error && <div className="form-error" role="alert">{error.message.split("\n")[0]}</div>}
    </form>
  );
}

/* ───────────────────────── Bits ───────────────────────── */

/** Same RainbowKit connect modal, styled as our primary button. */
function ConnectCta({ label = "Connect wallet" }: { label?: string }) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={openConnectModal} disabled={!mounted}>
          {label}
        </button>
      )}
    </ConnectButton.Custom>
  );
}

function Addr({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <span className="addr">
      <a href={`${EXPLORER}/address/${value}`} target="_blank" rel="noreferrer" className="tnum">{short(value)}</a>
      <button
        className="icon-btn"
        aria-label={copied ? "Copied" : "Copy address"}
        onClick={() => { navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => {}); }}
      >
        {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      </button>
    </span>
  );
}
