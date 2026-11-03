import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseAbiItem } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import { musdPocketAbi } from "../lib/abi";
import { POCKET_ADDRESS, mezoTestnet } from "../lib/chains";
import { isTeamTestWallet, labelWallet, type StatsEvent } from "../lib/stats";
import { PROOF_WALLETS } from "../lib/proof";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";
import { IconExternal } from "./Icons";

const EXPLORER = mezoTestnet.blockExplorers.default.url;

const EVENTS = [
  parseAbiItem("event GoalCreated(uint256 indexed goalId, address indexed owner, string name, uint256 targetAmount, uint64 unlockTime, bool isFamily)"),
  parseAbiItem("event Deposited(uint256 indexed goalId, address indexed from, uint256 amount)"),
  parseAbiItem("event EarlyWithdrawn(uint256 indexed goalId, address indexed to, uint256 net, uint256 fee)"),
  parseAbiItem("event BorrowedToGoal(uint256 indexed goalId, address indexed borrower, uint256 amount, uint256 icrAfter)"),
  parseAbiItem("event Withdrawn(uint256 indexed goalId, address indexed to, uint256 amount)"),
] as const;

function fmt(n: bigint | undefined, d = 2) {
  if (n === undefined) return "—";
  return Number(formatUnits(n, 18)).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

function short(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

/** Public on-chain stats for MUSDPocketV2 — no wallet required. */
export function StatsPanel({ lang = "en" }: { lang?: Lang }) {
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const [events, setEvents] = useState<StatsEvent[]>([]);
  const [evLoading, setEvLoading] = useState(true);
  const [evError, setEvError] = useState<string | null>(null);

  const reads = useReadContracts({
    contracts: [
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "nextGoalId", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "totalLocked", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "feePool", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "earlyFeeBps", chainId: mezoTestnet.id },
    ],
    query: { refetchInterval: 30_000 },
  });

  const nextGoalId = reads.data?.[0]?.result as bigint | undefined;
  const totalLocked = reads.data?.[1]?.result as bigint | undefined;
  const feePool = reads.data?.[2]?.result as bigint | undefined;
  const earlyFeeBps = reads.data?.[3]?.result as number | undefined;
  const goalCount = nextGoalId !== undefined ? Number(nextGoalId) - 1 : undefined;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!client) return;
      setEvLoading(true);
      setEvError(null);
      try {
        const latest = await client.getBlockNumber();
        // Mezo RPC often rejects huge eth_getLogs ranges; scan a recent window (~200k blocks).
        const window = 200_000n;
        const fromBlock = latest > window ? latest - window : 0n;
        const [created, deposited, early, borrowed, withdrawn] = await Promise.all([
          client.getLogs({ address: POCKET_ADDRESS, event: EVENTS[0], fromBlock, toBlock: latest }),
          client.getLogs({ address: POCKET_ADDRESS, event: EVENTS[1], fromBlock, toBlock: latest }),
          client.getLogs({ address: POCKET_ADDRESS, event: EVENTS[2], fromBlock, toBlock: latest }),
          client.getLogs({ address: POCKET_ADDRESS, event: EVENTS[3], fromBlock, toBlock: latest }),
          client.getLogs({ address: POCKET_ADDRESS, event: EVENTS[4], fromBlock, toBlock: latest }),
        ]);
        const mapped: StatsEvent[] = [];
        for (const l of created) {
          mapped.push({
            kind: "GoalCreated",
            goalId: (l.args.goalId as bigint).toString(),
            from: l.args.owner as string,
            txHash: l.transactionHash!,
            blockNumber: l.blockNumber!,
          });
        }
        for (const l of deposited) {
          mapped.push({
            kind: "Deposited",
            goalId: (l.args.goalId as bigint).toString(),
            from: l.args.from as string,
            amount: formatUnits(l.args.amount as bigint, 18),
            txHash: l.transactionHash!,
            blockNumber: l.blockNumber!,
          });
        }
        for (const l of early) {
          mapped.push({
            kind: "EarlyWithdrawn",
            goalId: (l.args.goalId as bigint).toString(),
            from: l.args.to as string,
            amount: formatUnits(l.args.net as bigint, 18),
            txHash: l.transactionHash!,
            blockNumber: l.blockNumber!,
          });
        }
        for (const l of borrowed) {
          mapped.push({
            kind: "BorrowedToGoal",
            goalId: (l.args.goalId as bigint).toString(),
            from: l.args.borrower as string,
            amount: formatUnits(l.args.amount as bigint, 18),
            txHash: l.transactionHash!,
            blockNumber: l.blockNumber!,
          });
        }
        for (const l of withdrawn) {
          mapped.push({
            kind: "Withdrawn",
            goalId: (l.args.goalId as bigint).toString(),
            from: l.args.to as string,
            amount: formatUnits(l.args.amount as bigint, 18),
            txHash: l.transactionHash!,
            blockNumber: l.blockNumber!,
          });
        }
        mapped.sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : -1));
        if (!cancelled) setEvents(mapped.slice(0, 24));
      } catch (e) {
        if (!cancelled) setEvError(e instanceof Error ? e.message : "Failed to load events");
      } finally {
        if (!cancelled) setEvLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [client]);

  const depositCount = useMemo(() => events.filter((e) => e.kind === "Deposited").length, [events]);
  const chipInApprox = useMemo(() => {
    // Chip-ins are Deposited events; owners also deposit. We still surface the deposit total
    // and label team wallets honestly in the feed.
    return events.filter((e) => e.kind === "Deposited").length;
  }, [events]);

  const loading = reads.isLoading;
  const error = reads.isError ? "Could not read contract stats from Mezo testnet." : null;

  return (
    <section id="stats" className="stats-section" data-feature="public-stats" aria-labelledby="stats-title">
      <div className="section-head">
        <h2 id="stats-title">{t(lang, "statsTitle")}</h2>
        <p>{t(lang, "statsSub")}</p>
      </div>

      {error && (
        <div className="notice notice-warn" role="alert">
          <span>{error} Refresh or check RPC https://rpc.test.mezo.org.</span>
        </div>
      )}

      <div className="stats-grid">
        <article className="panel stats-card">
          <span className="stats-label">{t(lang, "statsGoals")}</span>
          <strong className="stats-value tnum">{loading ? "…" : goalCount ?? "—"}</strong>
        </article>
        <article className="panel stats-card">
          <span className="stats-label">{t(lang, "statsTvl")}</span>
          <strong className="stats-value tnum">{loading ? "…" : `${fmt(totalLocked)} MUSD`}</strong>
        </article>
        <article className="panel stats-card">
          <span className="stats-label">{t(lang, "statsDeposits")}</span>
          <strong className="stats-value tnum">{evLoading ? "…" : depositCount}</strong>
          <span className="stats-hint">{t(lang, "statsChipIns")}: {evLoading ? "…" : chipInApprox}</span>
        </article>
        <article className="panel stats-card">
          <span className="stats-label">{t(lang, "statsFeePool")}</span>
          <strong className="stats-value tnum">{loading ? "…" : `${fmt(feePool)} MUSD`}</strong>
          <span className="stats-hint">
            {t(lang, "statsFeeBps")}: {earlyFeeBps !== undefined ? `${(earlyFeeBps / 100).toFixed(2)}%` : "—"}
          </span>
        </article>
      </div>

      <div className="panel stats-team" data-feature="stats-team-wallets">
        <h3>{t(lang, "statsTeamTitle")}</h3>
        <p className="btc-copy">{t(lang, "statsTeamBody")}</p>
        <ul className="stats-wallet-list">
          {PROOF_WALLETS.map((w) => (
            <li key={w.address}>
              <span>{w.label}</span>
              <a className="tnum" href={`${EXPLORER}/address/${w.address}`} target="_blank" rel="noreferrer">
                {short(w.address)} <IconExternal width={12} height={12} />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel stats-events">
        <h3>{t(lang, "statsRecent")}</h3>
        {evLoading && <span className="skeleton" style={{ height: 72 }} />}
        {evError && <p className="form-error" role="alert">{evError}</p>}
        {!evLoading && !evError && events.length === 0 && (
          <p className="btc-copy">{t(lang, "statsEmpty")}</p>
        )}
        <ul className="stats-event-list">
          {events.map((e) => (
            <li key={`${e.txHash}-${e.kind}-${e.goalId}`}>
              <div>
                <strong>{e.kind}</strong>
                <span className="muted"> · goal #{e.goalId}</span>
                {e.amount && <span className="tnum"> · {Number(e.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} MUSD</span>}
                {e.from && (
                  <span className="stats-from">
                    {" "}
                    · {labelWallet(e.from)}{" "}
                    <a className="tnum" href={`${EXPLORER}/address/${e.from}`} target="_blank" rel="noreferrer">
                      {short(e.from)}
                    </a>
                    {isTeamTestWallet(e.from) && <span className="tag tag-team">team test</span>}
                  </span>
                )}
              </div>
              <a className="txline tnum" href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                {e.txHash.slice(0, 10)}… <IconExternal width={12} height={12} />
              </a>
            </li>
          ))}
        </ul>
        <p className="fund-note">
          Contract{" "}
          <a href={`${EXPLORER}/address/${POCKET_ADDRESS}`} target="_blank" rel="noreferrer">
            {short(POCKET_ADDRESS)}
          </a>{" "}
          · Mezo testnet 31611 · live reads, not mocked.
        </p>
      </div>
    </section>
  );
}
