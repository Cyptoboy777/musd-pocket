/** Turn raw MUSD Pocket logs into a tester list. Pure, so it can be unit-tested. */
import { isTeamTestWallet } from "./stats";

export type PocketLog = {
  kind: "GoalCreated" | "Deposited" | "BorrowedToGoal";
  contract: "v2" | "v3";
  goalId: bigint;
  who: `0x${string}`;
  amount?: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
};

export type TesterRow = PocketLog & { chipIn: boolean };

export type TesterSummary = {
  outsideWallets: number;
  outsideDeposits: number;
  outsideChipIns: number;
  outsideMusd: bigint;
  rows: TesterRow[];
};

/**
 * Outside = not a known builder wallet. A chip-in is a deposit into a goal the depositor does
 * not own (goal owners come from GoalCreated in the same contract).
 */
export function summarizeTesters(logs: PocketLog[], extraTeam: string[] = []): TesterSummary {
  const team = new Set(extraTeam.map((a) => a.toLowerCase()));
  const isTeam = (a: string) => isTeamTestWallet(a) || team.has(a.toLowerCase());
  const owners = new Map<string, string>();
  for (const l of logs) if (l.kind === "GoalCreated") owners.set(`${l.contract}:${l.goalId}`, l.who.toLowerCase());

  const rows: TesterRow[] = [];
  const wallets = new Set<string>();
  let deposits = 0;
  let chipIns = 0;
  let musd = 0n;
  for (const l of logs) {
    if (isTeam(l.who)) continue;
    const owner = owners.get(`${l.contract}:${l.goalId}`);
    const chipIn = l.kind === "Deposited" && !!owner && owner !== l.who.toLowerCase();
    rows.push({ ...l, chipIn });
    wallets.add(l.who.toLowerCase());
    if (l.kind !== "GoalCreated") {
      deposits++;
      musd += l.amount ?? 0n;
    }
    if (chipIn) chipIns++;
  }
  rows.sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1));
  return { outsideWallets: wallets.size, outsideDeposits: deposits, outsideChipIns: chipIns, outsideMusd: musd, rows };
}
