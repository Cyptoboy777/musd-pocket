import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { musdPocketAbi } from "../lib/abi";
import { POCKET_ADDRESS, mezoTestnet } from "../lib/chains";
import { useCountUp } from "../hooks/useCountUp";

const toNumber = (v: bigint | undefined) => (v === undefined ? undefined : Number(formatUnits(v, 18)));

function Stat({ label, value, unit, digits }: { label: string; value: number | undefined; unit?: string; digits: number }) {
  const shown = useCountUp(value ?? 0);
  return (
    <div className="hero-stat">
      <dt>{label}</dt>
      <dd className="tnum">
        {value === undefined ? (
          <span className="hero-stat-empty" aria-label="not available yet">—</span>
        ) : (
          <>
            {shown.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
            {unit && <small>{unit}</small>}
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * Live numbers read straight from the Pocket contract. Nothing is hard-coded:
 * while a value cannot be read it shows a dash, and a real zero shows as zero.
 */
export function HeroStats() {
  const reads = useReadContracts({
    contracts: [
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "nextGoalId", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "totalLocked", chainId: mezoTestnet.id },
      { address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "totalInVault", chainId: mezoTestnet.id },
    ],
    query: { refetchInterval: 30_000 },
  });
  const nextGoalId = reads.data?.[0]?.result as bigint | undefined;
  const locked = reads.data?.[1]?.result as bigint | undefined;
  const inVault = reads.data?.[2]?.result as bigint | undefined;
  const goals = nextGoalId !== undefined ? Math.max(0, Number(nextGoalId) - 1) : undefined;

  return (
    <div className="hero-stats-wrap" data-feature="hero-stats">
      <dl className="hero-stats">
        <Stat label="Goals created" value={goals} digits={0} />
        <Stat label="MUSD locked in goals" value={toNumber(locked)} digits={2} />
        <Stat label="MUSD earning in the vault" value={toNumber(inVault)} digits={2} />
      </dl>
      <p className="hero-stats-note">Read from the contract on Mezo testnet, not typed in.</p>
    </div>
  );
}
