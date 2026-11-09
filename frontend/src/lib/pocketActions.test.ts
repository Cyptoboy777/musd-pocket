import { describe, expect, it } from "vitest";
import { parseUnits, type Address, type Hex } from "viem";
import { MEZO, POCKET_ADDRESS, MEZO_MAINNET_CHAIN_ID, mezoTestnet } from "./chains";
import { createPocketActions, type PocketActionDeps, type PocketWrite } from "./mezo";
import { walletErrorCopy } from "../hooks/useTxFeedback";

const USER = "0x00000000000000000000000000000000000000a1" as Address;
const OTHER = "0x00000000000000000000000000000000000000b2" as Address;
const SIG = ("0x" + "11".repeat(32) + "22".repeat(32) + "1b") as Hex;
const APPROVE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
const REPAY = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex;
const ONE = parseUnits("1", 18);
const DEBT = [ONE, parseUnits("2000", 18), 0n, 0n, 0n, 0n] as const;

function harness(opts?: {
  chain?: number;
  allowance?: bigint;
  receipt?: { status: "success" | "reverted" } | "throw";
  flipChainOnSign?: boolean;
  repayError?: Error;
}) {
  let chain = opts?.chain ?? mezoTestnet.id;
  const writes: PocketWrite[] = [];
  const reads: string[] = [];
  const deps: PocketActionDeps = {
    getChainId: () => chain,
    getAddress: () => USER,
    readContract: async (args) => {
      reads.push(args.functionName);
      if (args.functionName === "nonces") return 0n;
      if (args.functionName === "allowance") return opts?.allowance ?? parseUnits("1000", 18);
      if (args.functionName === "getTroveStatus") return 1;
      if (args.functionName === "getEntireDebtAndColl") return DEBT;
      if (args.functionName === "fetchPrice") return parseUnits("80000", 18);
      if (args.functionName === "getApproxHint") return [OTHER, 0n, 1n];
      if (args.functionName === "findInsertPosition") return [OTHER, OTHER];
      if (args.functionName === "getNonce") return 0n;
      throw new Error(`unexpected read ${args.functionName}`);
    },
    signTypedData: async () => {
      if (opts?.flipChainOnSign) chain = MEZO_MAINNET_CHAIN_ID;
      return SIG;
    },
    writeContract: async (args) => {
      writes.push(args);
      if (args.functionName === "repayMUSD" && opts?.repayError) throw opts.repayError;
      return args.functionName === "approve" ? APPROVE : REPAY;
    },
    waitForReceipt: async () => {
      if (opts?.receipt === "throw") throw new Error("timeout");
      return opts?.receipt ?? { status: "success" as const };
    },
  };
  return { actions: createPocketActions(deps), writes, reads, setChain: (id: number) => { chain = id; } };
}

const trove = { coll: 1, debt: 2000 };

describe("pocket action dispatch", () => {
  it("sends deposit, send, borrow, collateral, and close only on testnet pocket or Mezo contracts", async () => {
    const { actions, writes } = harness();
    await actions.depositWithPermit(4n, "10");
    await actions.sendWithPermit(OTHER, "5", "rent");
    await actions.borrowToGoal(4n, "10", trove);
    await actions.addCollateral("0.01", trove);
    await actions.closeLoan();
    expect(writes.map((w) => w.functionName)).toEqual([
      "depositWithPermit", "sendWithPermit", "borrowToGoal", "addColl", "closeTrove",
    ]);
    for (const w of writes) expect(w.chainId).toBe(mezoTestnet.id);
    expect(writes[0]?.address).toBe(POCKET_ADDRESS);
    expect(writes[1]?.address).toBe(POCKET_ADDRESS);
    expect(writes[2]?.address).toBe(POCKET_ADDRESS);
    expect(writes[3]?.address).toBe(MEZO.borrowerOperations);
    expect(writes[4]?.address).toBe(MEZO.borrowerOperations);
    expect(writes.some((w) => w.address.toLowerCase() === "0xec03f758219746b6e773f107a05cf17b66e7d460" && w.chainId !== mezoTestnet.id)).toBe(false);
  });

  it("rejects every financial path on the wrong chain before a write", async () => {
    const paths = [
      (h: ReturnType<typeof harness>) => h.actions.depositWithPermit(1n, "1"),
      (h: ReturnType<typeof harness>) => h.actions.sendWithPermit(OTHER, "1", "note"),
      (h: ReturnType<typeof harness>) => h.actions.borrowToGoal(1n, "1", trove),
      (h: ReturnType<typeof harness>) => h.actions.addCollateral("0.01", trove),
      (h: ReturnType<typeof harness>) => h.actions.repayLoan("10", trove),
      (h: ReturnType<typeof harness>) => h.actions.closeLoan(),
    ];
    for (const run of paths) {
      const h = harness({ chain: MEZO_MAINNET_CHAIN_ID });
      await expect(run(h)).rejects.toThrow(/POCKET_TESTNET_ONLY/);
      expect(h.writes).toEqual([]);
    }
  });

  it("does not broadcast a deposit if the wallet network changes while signing", async () => {
    const { actions, writes } = harness({ flipChainOnSign: true });
    await expect(actions.depositWithPermit(2n, "3")).rejects.toThrow(/POCKET_TESTNET_ONLY/);
    expect(writes).toEqual([]);
  });

  it("repays without an approval when allowance is already enough", async () => {
    const { actions, writes } = harness({ allowance: parseUnits("50", 18) });
    await actions.repayLoan("10", trove);
    expect(writes.map((w) => w.functionName)).toEqual(["repayMUSD"]);
    expect(writes[0]?.address).toBe(MEZO.borrowerOperations);
    expect(writes[0]?.chainId).toBe(mezoTestnet.id);
  });

  it("waits for a successful approval receipt before submitting repay", async () => {
    const order: string[] = [];
    const actions = createPocketActions({
      getChainId: () => mezoTestnet.id,
      getAddress: () => USER,
      readContract: async (args) => {
        if (args.functionName === "allowance") return 0n;
        if (args.functionName === "getApproxHint") return [OTHER, 0n, 1n];
        return [OTHER, OTHER];
      },
      signTypedData: async () => SIG,
      writeContract: async (args) => {
        order.push(`write:${args.functionName}`);
        return args.functionName === "approve" ? APPROVE : REPAY;
      },
      waitForReceipt: async (hash) => {
        order.push(`receipt:${hash}`);
        return { status: "success" };
      },
    });
    await actions.repayLoan("10", trove);
    expect(order).toEqual([`write:approve`, `receipt:${APPROVE}`, "write:repayMUSD"]);
  });

  it("keeps the submitted approval in view if the repayment prompt is declined", async () => {
    const h = harness({ allowance: 0n, repayError: new Error("User rejected the request.") });
    await expect(h.actions.repayLoan("10", trove)).rejects.toThrow(/REPAY_AFTER_APPROVAL/);
    expect(h.writes.map((w) => w.functionName)).toEqual(["approve", "repayMUSD"]);
    const copy = walletErrorCopy(new Error("REPAY_AFTER_APPROVAL User rejected the request."));
    expect(copy.notSubmitted).toBe(false);
    expect(copy.body).toMatch(/approval was submitted/i);
    expect(copy.body).not.toMatch(/Nothing was sent/);
  });

  it("keeps the submitted approval in view if repayment lacks gas", async () => {
    const h = harness({ allowance: 0n, repayError: new Error("insufficient funds for gas * price + value") });
    await expect(h.actions.repayLoan("10", trove)).rejects.toThrow(/REPAY_AFTER_APPROVAL/);
    expect(h.writes.map((w) => w.functionName)).toEqual(["approve", "repayMUSD"]);
    const copy = walletErrorCopy(new Error("REPAY_AFTER_APPROVAL insufficient funds for gas * price + value"));
    expect(copy.notSubmitted).toBe(false);
    expect(copy.body).toMatch(/approval was submitted/i);
    expect(copy.body).not.toMatch(/Nothing was sent|failed/i);
  });

  it("does not submit repay when the approval receipt reverts or never confirms", async () => {
    const reverted = harness({ allowance: 0n, receipt: { status: "reverted" } });
    await expect(reverted.actions.repayLoan("10", trove)).rejects.toThrow(/APPROVAL_REVERTED/);
    expect(reverted.writes.map((w) => w.functionName)).toEqual(["approve"]);

    const unknown = harness({ allowance: 0n, receipt: "throw" });
    await expect(unknown.actions.repayLoan("10", trove)).rejects.toThrow(/APPROVAL_UNCONFIRMED/);
    expect(unknown.writes.map((w) => w.functionName)).toEqual(["approve"]);
  });

  it("does not describe an unknown or half-finished step as unsent", () => {
    expect(walletErrorCopy(new Error("User rejected the request.")).notSubmitted).toBe(true);
    expect(walletErrorCopy(new Error("POCKET_TESTNET_ONLY")).body).toMatch(/Nothing was sent/);
    const pending = walletErrorCopy(new Error("APPROVAL_UNCONFIRMED"));
    expect(pending.notSubmitted).toBe(false);
    expect(pending.body).not.toMatch(/Nothing was sent|failed/i);
    const reverted = walletErrorCopy(new Error("APPROVAL_REVERTED"));
    expect(reverted.body).toMatch(/not submitted/);
    expect(reverted.body).not.toMatch(/Nothing was sent/);
    const ambiguous = walletErrorCopy(new Error("viem TransactionExecutionError https://rpc.test.mezo.org"));
    expect(ambiguous.notSubmitted).toBe(false);
    expect(ambiguous.body).not.toMatch(/Nothing was sent|not sent|failed|viem|rpc\./i);
    expect(ambiguous.body).toMatch(/Check your wallet/);
    const leak = walletErrorCopy(new Error("VITE_POCKET_ADDRESS\n    at main.tsx:1:1"));
    expect(leak.body).not.toMatch(/VITE_|at main/);
    expect(leak.title).not.toMatch(/VITE_|at main/);
  });
});
