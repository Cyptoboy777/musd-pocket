import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { formatUnits, parseUnits, isAddress, zeroAddress } from "viem";
import { musdPocketAbi, erc20Abi } from "./lib/abi";
import { MUSD_ADDRESS, POCKET_ADDRESS, mezoTestnet } from "./lib/chains";

type Tab = "goals" | "save" | "send";

function fmt(n: bigint | undefined, digits = 2) {
  if (n === undefined) return "—";
  const v = Number(formatUnits(n, 18));
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function short(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [tab, setTab] = useState<Tab>("goals");
  const deployed = POCKET_ADDRESS !== zeroAddress;

  const { data: musdBal } = useReadContract({
    address: MUSD_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: goalIds } = useReadContract({
    address: POCKET_ADDRESS,
    abi: musdPocketAbi,
    functionName: "goalsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && deployed },
  });

  const wrongNetwork = isConnected && chainId !== mezoTestnet.id;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">₹</div>
          <div>
            <h1>MUSD Pocket</h1>
            <p>Bitcoin-backed savings · Mezo</p>
          </div>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
      </header>

      <section className="hero">
        <div className="label">Your MUSD balance</div>
        <div className="balance">
          {isConnected ? fmt(musdBal as bigint | undefined) : "0.00"}
          <span>MUSD</span>
        </div>
        <div className="pills">
          <div className="pill">Network · <strong>Mezo Testnet</strong></div>
          <div className="pill">Gas · <strong>BTC</strong></div>
          <div className="pill">Stable · <strong>Bitcoin-backed</strong></div>
        </div>
      </section>

      {!deployed && (
        <div className="notice">
          Contract not deployed yet. Fund the deployer with testnet BTC from{" "}
          <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">
            faucet.test.mezo.org
          </a>
          , then redeploy. UI + ABIs are ready for Mezo testnet MUSD.
        </div>
      )}

      {wrongNetwork && (
        <div className="notice">
          Switch wallet to <strong>Mezo Testnet (chain 31611)</strong> to continue.
        </div>
      )}

      <nav className="tabs">
        <button className={`tab ${tab === "goals" ? "active" : ""}`} onClick={() => setTab("goals")}>
          Goals
        </button>
        <button className={`tab ${tab === "save" ? "active" : ""}`} onClick={() => setTab("save")}>
          Save
        </button>
        <button className={`tab ${tab === "send" ? "active" : ""}`} onClick={() => setTab("send")}>
          Send
        </button>
      </nav>

      {tab === "goals" && (
        <GoalsPanel goalIds={(goalIds as bigint[] | undefined) || []} deployed={deployed} />
      )}
      {tab === "save" && <SavePanel deployed={deployed} />}
      {tab === "send" && <SendPanel deployed={deployed} />}

      <footer className="footer">
        Access &amp; Distribution track · AKINDO Mezo Buildathon ·{" "}
        <a href="https://explorer.test.mezo.org" target="_blank" rel="noreferrer">
          Explorer
        </a>
        <div className="check">Pocket: {short(POCKET_ADDRESS)} · MUSD: {short(MUSD_ADDRESS)}</div>
      </footer>
    </div>
  );
}

function GoalsPanel({ goalIds, deployed }: { goalIds: bigint[]; deployed: boolean }) {
  if (!deployed) {
    return (
      <div className="empty">
        Connect after deploy to see FD-style goals — Emergency, Wedding, Education…
      </div>
    );
  }
  if (!goalIds.length) {
    return <div className="empty">No goals yet. Open the Save tab to create your first pocket.</div>;
  }
  return (
    <>
      {goalIds.map((id) => (
        <GoalCard key={id.toString()} goalId={id} />
      ))}
    </>
  );
}

function GoalCard({ goalId }: { goalId: bigint }) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash });
  const { data } = useReadContract({
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

  async function approveAndDeposit() {
    if (!addAmt || !address) return;
    const amount = parseUnits(addAmt, 18);
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
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: "deposit",
      args: [goalId, parseUnits(addAmt, 18)],
    });
  }

  function withdraw() {
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: locked ? "earlyWithdraw" : "withdraw",
      args: [goalId],
    });
  }

  return (
    <div className="card goal">
      <div className="goal-head">
        <div>
          <h4>{name}</h4>
          <div className="meta">
            {fmt(balance)} / {fmt(target)} MUSD · {isFamily ? "Family" : "Personal"} ·{" "}
            unlock {unlock.toLocaleDateString()}
          </div>
        </div>
        <span className={`badge ${locked ? "lock" : ""}`}>{locked ? "Locked" : "Ready"}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="field">
        <label>Add MUSD to this goal</label>
        <input
          inputMode="decimal"
          placeholder="e.g. 100"
          value={addAmt}
          onChange={(e) => setAddAmt(e.target.value)}
        />
      </div>
      <div className="btn-row">
        <button className="btn secondary" disabled={isPending || confirming} onClick={approveAndDeposit}>
          Approve
        </button>
        <button className="btn" disabled={isPending || confirming} onClick={deposit}>
          Deposit
        </button>
      </div>
      <button
        className={`btn ${locked ? "danger" : ""}`}
        style={{ marginTop: 8 }}
        disabled={isPending || confirming || balance === 0n}
        onClick={withdraw}
      >
        {locked ? "Early withdraw (2% fee)" : "Withdraw unlocked"}
      </button>
      {hash && <div className="check">tx: {hash}</div>}
    </div>
  );
}

function SavePanel({ deployed }: { deployed: boolean }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash });
  const [name, setName] = useState("Emergency FD");
  const [target, setTarget] = useState("1000");
  const [days, setDays] = useState("30");
  const [family, setFamily] = useState(false);

  const unlockPreview = useMemo(() => {
    const d = Number(days) || 0;
    return new Date(Date.now() + d * 86400000).toLocaleDateString();
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

  return (
    <div className="card">
      <h3>New savings goal</h3>
      <p className="meta" style={{ marginTop: -4, marginBottom: 12 }}>
        Like a fixed deposit — lock MUSD until your date. Family goals let relatives chip in.
      </p>
      <div className="field">
        <label>Goal name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
      </div>
      <div className="row">
        <div className="field">
          <label>Target (MUSD)</label>
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="field">
          <label>Lock days (min 1)</label>
          <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={family}
            onChange={(e) => setFamily(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Family goal (invite members later)
        </label>
      </div>
      <div className="meta" style={{ marginBottom: 10 }}>
        Unlocks around {unlockPreview}
      </div>
      <button className="btn" disabled={!deployed || isPending || confirming} onClick={create}>
        {isPending || confirming ? "Confirm in wallet…" : "Create goal"}
      </button>
      {hash && <div className="check">tx: {hash}</div>}
      {error && <div className="check" style={{ color: "var(--danger)" }}>{error.message}</div>}
    </div>
  );
}

function SendPanel({ deployed }: { deployed: boolean }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash });
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("50");
  const [memo, setMemo] = useState("Ma rent");

  function approve() {
    if (!isAddress(to) || !amount) return;
    writeContract({
      address: MUSD_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [POCKET_ADDRESS, parseUnits(amount, 18)],
    });
  }

  function send() {
    if (!deployed || !isAddress(to)) return;
    writeContract({
      address: POCKET_ADDRESS,
      abi: musdPocketAbi,
      functionName: "sendRemittance",
      args: [to as `0x${string}`, parseUnits(amount, 18), memo],
    });
  }

  return (
    <div className="card">
      <h3>Send to family</h3>
      <p className="meta" style={{ marginTop: -4, marginBottom: 12 }}>
        Remit MUSD with an on-chain memo — clear for Ma, Papa, or school fees.
      </p>
      <div className="field">
        <label>Recipient address</label>
        <input placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Amount (MUSD)</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Memo</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={96} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn secondary" disabled={!deployed || isPending || confirming} onClick={approve}>
          Approve
        </button>
        <button className="btn" disabled={!deployed || isPending || confirming || !isAddress(to)} onClick={send}>
          Send MUSD
        </button>
      </div>
      {hash && <div className="check">tx: {hash}</div>}
      {error && <div className="check" style={{ color: "var(--danger)" }}>{error.message}</div>}
    </div>
  );
}
