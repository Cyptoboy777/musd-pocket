import { describe, expect, it } from "vitest";
import { summarizeTesters, type PocketLog } from "./testers";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
const TEAM = "0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA" as const;
const h = (n: number) => (`0x${n.toString(16).padStart(64, "0")}`) as `0x${string}`;

describe("summarizeTesters", () => {
  it("excludes builder wallets and counts chip-ins", () => {
    const logs: PocketLog[] = [
      { kind: "GoalCreated", contract: "v3", goalId: 1n, who: A, txHash: h(1), blockNumber: 1n },
      { kind: "Deposited", contract: "v3", goalId: 1n, who: A, amount: 10n, txHash: h(2), blockNumber: 2n },
      { kind: "Deposited", contract: "v3", goalId: 1n, who: B, amount: 5n, txHash: h(3), blockNumber: 3n },
      { kind: "Deposited", contract: "v3", goalId: 1n, who: TEAM, amount: 99n, txHash: h(4), blockNumber: 4n },
    ];
    const s = summarizeTesters(logs);
    expect(s.outsideWallets).toBe(2);
    expect(s.outsideDeposits).toBe(2);
    expect(s.outsideChipIns).toBe(1);
    expect(s.outsideMusd).toBe(15n);
    expect(s.rows[0].txHash).toBe(h(3));
  });

  it("does not mix goal ids across contract versions", () => {
    const logs: PocketLog[] = [
      { kind: "GoalCreated", contract: "v2", goalId: 1n, who: A, txHash: h(1), blockNumber: 1n },
      { kind: "Deposited", contract: "v3", goalId: 1n, who: A, amount: 1n, txHash: h(2), blockNumber: 2n },
    ];
    expect(summarizeTesters(logs).outsideChipIns).toBe(0);
  });

  it("returns zeros, not invented numbers, when there is no outside activity", () => {
    const s = summarizeTesters([]);
    expect(s).toMatchObject({ outsideWallets: 0, outsideDeposits: 0, outsideChipIns: 0, outsideMusd: 0n });
  });
});
