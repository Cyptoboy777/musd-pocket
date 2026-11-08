import { useAccount, useBalance, useChainId, usePublicClient, useReadContracts, useSignTypedData, useWriteContract } from "wagmi";
import { formatUnits, parseSignature, parseUnits, type Address, type Hex } from "viem";
import { useRef } from "react";
import { MEZO, MEZO_TOKEN, MUSD_ADDRESS, POCKET_ADDRESS, mezoTestnet, pocketWritesAllowed } from "./chains";
import { musdPocketAbi } from "./abi";
import type { Trove } from "./risk";

/* ───────────── Minimal ABIs for Mezo's MUSD protocol ───────────── */

export const troveManagerAbi = [
  {
    type: "function", name: "getEntireDebtAndColl", stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [
      { name: "coll", type: "uint256" }, { name: "principal", type: "uint256" }, { name: "interest", type: "uint256" },
      { name: "pendingCollateral", type: "uint256" }, { name: "pendingPrincipal", type: "uint256" }, { name: "pendingInterest", type: "uint256" },
    ],
  },
  { type: "function", name: "getTroveStatus", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "checkRecoveryMode", stateMutability: "view", inputs: [{ name: "_price", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const priceFeedAbi = [
  { type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const bosAbi = [
  { type: "function", name: "getNonce", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const hintHelpersAbi = [
  {
    type: "function", name: "getApproxHint", stateMutability: "view",
    inputs: [{ name: "_CR", type: "uint256" }, { name: "_numTrials", type: "uint256" }, { name: "_inputRandomSeed", type: "uint256" }],
    outputs: [{ name: "hintAddress", type: "address" }, { name: "diff", type: "uint256" }, { name: "latestRandomSeed", type: "uint256" }],
  },
] as const;

export const sortedTrovesAbi = [
  {
    type: "function", name: "findInsertPosition", stateMutability: "view",
    inputs: [{ name: "_NICR", type: "uint256" }, { name: "_prevId", type: "address" }, { name: "_nextId", type: "address" }],
    outputs: [{ type: "address" }, { type: "address" }],
  },
] as const;


export const borrowerOperationsAbi = [
  {
    type: "function", name: "addColl", stateMutability: "payable",
    inputs: [{ name: "_upperHint", type: "address" }, { name: "_lowerHint", type: "address" }],
    outputs: [],
  },
  {
    type: "function", name: "repayMUSD", stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" },
    ],
    outputs: [],
  },
  { type: "function", name: "closeTrove", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

/** Compute SortedTroves insert hints for a projected NICR. */
type ReadClient = {
  readContract: (args: any) => Promise<any>;
};

export async function computeHints(
  client: ReadClient,
  collWei: bigint,
  debtWei: bigint,
): Promise<{ upper: Address; lower: Address; nicr: bigint }> {
  if (debtWei === 0n) {
    const zero = "0x0000000000000000000000000000000000000000" as Address;
    return { upper: zero, lower: zero, nicr: 0n };
  }
  const nicr = (collWei * 10n ** 20n) / debtWei;
  const [hint] = await client.readContract({
    address: MEZO.hintHelpers, abi: hintHelpersAbi, functionName: "getApproxHint",
    args: [nicr, 15n, BigInt(Math.floor(Math.random() * 1e9))],
  });
  const [upper, lower] = await client.readContract({
    address: MEZO.sortedTroves, abi: sortedTrovesAbi, functionName: "findInsertPosition",
    args: [nicr, hint, hint],
  });
  return { upper, lower, nicr };
}

export const permitAbi = [
  { type: "function", name: "nonces", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const erc20BalanceAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/* ───────────── Read: the wallet's Mezo loan, BTC price and MEZO ───────────── */

export type MezoPosition = {
  loading: boolean;
  price?: number; // USD per BTC, from Mezo's PriceFeed
  trove?: Trove; // undefined when there is no active loan
  status?: number; // 1 = active
  recoveryMode?: boolean;
  mezo?: number; // MEZO token balance
  btc?: number; // wallet BTC (gas + potential collateral)
  refetch: () => void;
};

const toN = (v: unknown) => (typeof v === "bigint" ? Number(formatUnits(v, 18)) : undefined);

export function useMezoPosition(): MezoPosition {
  const { address } = useAccount();
  const enabled = !!address;
  const { data, isLoading, refetch } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: MEZO.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice", chainId: mezoTestnet.id },
      { address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [address!], chainId: mezoTestnet.id },
      { address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [address!], chainId: mezoTestnet.id },
      { address: MEZO_TOKEN, abi: erc20BalanceAbi, functionName: "balanceOf", args: [address!], chainId: mezoTestnet.id },
    ],
    query: { enabled, refetchInterval: 30_000 },
  });
  const { data: btcBal } = useBalance({ address, chainId: mezoTestnet.id, query: { enabled } });

  const priceRaw = data?.[0]?.result as bigint | undefined;
  const status = data?.[1]?.result as number | undefined;
  const dc = data?.[2]?.result as readonly bigint[] | undefined;
  const { data: rm } = useReadContracts({
    allowFailure: true,
    contracts: [{ address: MEZO.troveManager, abi: troveManagerAbi, functionName: "checkRecoveryMode", args: [priceRaw ?? 0n], chainId: mezoTestnet.id }],
    query: { enabled: priceRaw !== undefined },
  });

  let trove: Trove | undefined;
  if (status === 1 && dc) {
    const [coll, principal, interest, pColl, pPrincipal, pInterest] = dc;
    trove = {
      coll: Number(formatUnits(coll + pColl, 18)),
      debt: Number(formatUnits(principal + interest + pPrincipal + pInterest, 18)),
    };
  }
  return {
    loading: enabled && isLoading,
    price: toN(priceRaw),
    trove,
    status,
    recoveryMode: rm?.[0]?.result as boolean | undefined,
    mezo: toN(data?.[3]?.result),
    btc: btcBal ? Number(formatUnits(btcBal.value, 18)) : undefined,
    refetch: () => { void refetch(); },
  };
}

/* ───────────── Write: one-signature deposits and borrow-to-goal ───────────── */

const EIP712_DEADLINE = () => BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

const allowanceAbi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export type PocketWrite = {
  address: Address;
  abi: readonly unknown[] | object;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  chainId: number;
};

export type PocketActionDeps = {
  getChainId: () => number | undefined;
  getAddress: () => Address | undefined;
  readContract: (args: { address: Address; abi: readonly unknown[] | object; functionName: string; args?: readonly unknown[] }) => Promise<unknown>;
  signTypedData: (args: Record<string, unknown>) => Promise<Hex>;
  writeContract: (args: PocketWrite) => Promise<Hex>;
  waitForReceipt: (hash: Hex) => Promise<{ status: "success" | "reverted" }>;
};

/** Before any broadcast, a wrong chain means nothing was submitted. After one, say the network changed. */
function requireTestnet(deps: PocketActionDeps, alreadySubmitted = false) {
  if (!pocketWritesAllowed(deps.getChainId())) {
    throw new Error(alreadySubmitted ? "CHAIN_CHANGED" : "POCKET_TESTNET_ONLY");
  }
}

export function createPocketActions(deps: PocketActionDeps) {
  async function permit(amount: bigint) {
    requireTestnet(deps);
    const address = deps.getAddress();
    if (!address) throw new Error("Connect a wallet first.");
    const nonce = await deps.readContract({ address: MUSD_ADDRESS, abi: permitAbi, functionName: "nonces", args: [address] });
    const deadline = EIP712_DEADLINE();
    const sig = await deps.signTypedData({
      domain: { name: "Mezo USD", version: "1", chainId: mezoTestnet.id, verifyingContract: MUSD_ADDRESS },
      types: { Permit: [
        { name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
      ] },
      primaryType: "Permit",
      message: { owner: address, spender: POCKET_ADDRESS, value: amount, nonce, deadline },
    });
    requireTestnet(deps);
    const { r, s, v, yParity } = parseSignature(sig);
    return { deadline, r, s, v: Number(v ?? BigInt(27 + (yParity ?? 0))) };
  }

  async function depositWithPermit(goalId: bigint, amountStr: string): Promise<Hex> {
    const amount = parseUnits(amountStr, 18);
    const p = await permit(amount);
    requireTestnet(deps);
    return deps.writeContract({
      address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "depositWithPermit",
      args: [goalId, amount, p.deadline, p.v, p.r, p.s], chainId: mezoTestnet.id,
    });
  }

  async function sendWithPermit(to: `0x${string}`, amountStr: string, memo: string): Promise<Hex> {
    const amount = parseUnits(amountStr, 18);
    const p = await permit(amount);
    requireTestnet(deps);
    return deps.writeContract({
      address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "sendWithPermit",
      args: [to, amount, memo, p.deadline, p.v, p.r, p.s], chainId: mezoTestnet.id,
    });
  }

  /**
   * Borrow `amountStr` MUSD from the caller's own Mezo loan straight into a goal.
   * 1. Work out where the loan will sit in Mezo's sorted list (hints keep gas ~0.5M instead of ~5M).
   * 2. Sign Mezo's own WithdrawMUSD message with recipient = MUSD Pocket.
   * 3. MUSD Pocket submits it, credits the goal and reverts if the loan would end under 150%.
   */
  async function borrowToGoal(goalId: bigint, amountStr: string, trove: Trove): Promise<Hex> {
    requireTestnet(deps);
    const address = deps.getAddress();
    if (!address) throw new Error("Connect a wallet first.");
    const amount = parseUnits(amountStr, 18);
    // Re-read trove + price at send time: BTC moves, and stale UI math can understate debt.
    const [status, dc, priceRaw] = await Promise.all([
      deps.readContract({ address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [address] }),
      deps.readContract({ address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [address] }),
      deps.readContract({ address: MEZO.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" }),
    ]);
    if (status !== 1) throw new Error("No active Mezo loan on this wallet.");
    const [coll, principal, interest, pColl, pPrincipal, pInterest] = dc as readonly bigint[];
    const live: Trove = {
      coll: Number(formatUnits(coll + pColl, 18)),
      debt: Number(formatUnits(principal + interest + pPrincipal + pInterest, 18)),
    };
    const price = Number(formatUnits(priceRaw as bigint, 18));
    const maxSafe = Math.floor((((live.coll * price) / 1.5) - live.debt) / 1.001 * 100) / 100;
    if (Number(amountStr) > maxSafe + 1e-9) {
      throw new Error(`Price moved. At most ${maxSafe.toFixed(2)} MUSD keeps you at 150% right now.`);
    }
    const collWei = parseUnits(live.coll.toFixed(18), 18);
    const newDebtWei = parseUnits(live.debt.toFixed(18), 18) + (amount * 1001n) / 1000n;
    const nicr = (collWei * 10n ** 20n) / newDebtWei;
    void trove; // UI snapshot; live values above win

    const [hint] = await deps.readContract({
      address: MEZO.hintHelpers, abi: hintHelpersAbi, functionName: "getApproxHint",
      args: [nicr, 15n, BigInt(Math.floor(Math.random() * 1e9))],
    }) as readonly [Address, bigint, bigint];
    const [upper, lower] = await deps.readContract({
      address: MEZO.sortedTroves, abi: sortedTrovesAbi, functionName: "findInsertPosition", args: [nicr, hint, hint],
    }) as readonly [Address, Address];
    const nonce = await deps.readContract({ address: MEZO.borrowerOpsSignatures, abi: bosAbi, functionName: "getNonce", args: [address] });
    const deadline = EIP712_DEADLINE();
    const signature = await deps.signTypedData({
      domain: { name: "BorrowerOperationsSignatures", version: "1", chainId: mezoTestnet.id, verifyingContract: MEZO.borrowerOpsSignatures },
      types: { WithdrawMUSD: [
        { name: "amount", type: "uint256" }, { name: "borrower", type: "address" }, { name: "recipient", type: "address" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
      ] },
      primaryType: "WithdrawMUSD",
      message: { amount, borrower: address, recipient: POCKET_ADDRESS, nonce, deadline },
    });
    requireTestnet(deps);
    return deps.writeContract({
      address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "borrowToGoal",
      args: [goalId, amount, upper, lower, signature, deadline], chainId: mezoTestnet.id,
    });
  }

  /**
   * One-click addColl via BorrowerOperations with SortedTroves hints.
   * `btcStr` is BTC amount sent as msg.value (18 decimals on Mezo).
   */
  async function addCollateral(btcStr: string, trove: Trove): Promise<Hex> {
    requireTestnet(deps);
    if (!deps.getAddress()) throw new Error("Connect a wallet first.");
    const value = parseUnits(btcStr, 18);
    if (value <= 0n) throw new Error("Enter a BTC amount greater than zero.");
    const collWei = parseUnits((trove.coll + Number(btcStr)).toFixed(18), 18);
    const debtWei = parseUnits(trove.debt.toFixed(18), 18);
    const { upper, lower } = await computeHints({ readContract: deps.readContract }, collWei, debtWei);
    requireTestnet(deps);
    return deps.writeContract({
      address: MEZO.borrowerOperations, abi: borrowerOperationsAbi, functionName: "addColl",
      args: [upper, lower], value, chainId: mezoTestnet.id,
    });
  }

  /** Repay MUSD against the caller's trove. Approval, when needed, must be confirmed first. */
  async function repayLoan(amountStr: string, trove: Trove): Promise<Hex> {
    requireTestnet(deps);
    const address = deps.getAddress();
    if (!address) throw new Error("Connect a wallet first.");
    const amount = parseUnits(amountStr, 18);
    if (amount <= 0n) throw new Error("Enter a MUSD amount greater than zero.");
    const collWei = parseUnits(trove.coll.toFixed(18), 18);
    const newDebt = Math.max(0, trove.debt - Number(amountStr));
    const debtWei = parseUnits(newDebt.toFixed(18), 18);
    const { upper, lower } = await computeHints({ readContract: deps.readContract }, collWei, debtWei === 0n ? 1n : debtWei);
    const allowance = await deps.readContract({
      address: MUSD_ADDRESS, abi: allowanceAbi, functionName: "allowance",
      args: [address, MEZO.borrowerOperations],
    });
    if ((allowance as bigint) < amount) {
      requireTestnet(deps);
      const approveHash = await deps.writeContract({
        address: MUSD_ADDRESS, abi: allowanceAbi, functionName: "approve",
        args: [MEZO.borrowerOperations, amount], chainId: mezoTestnet.id,
      });
      let receipt: { status: "success" | "reverted" };
      try {
        receipt = await deps.waitForReceipt(approveHash);
      } catch {
        throw new Error("APPROVAL_UNCONFIRMED");
      }
      if (receipt.status !== "success") throw new Error("APPROVAL_REVERTED");
      requireTestnet(deps, true);
    }
    requireTestnet(deps, (allowance as bigint) < amount);
    return deps.writeContract({
      address: MEZO.borrowerOperations, abi: borrowerOperationsAbi, functionName: "repayMUSD",
      args: [amount, upper, lower], chainId: mezoTestnet.id,
    });
  }

  /** Close the caller's trove. Needs enough MUSD in wallet to cover outstanding debt. */
  async function closeLoan(): Promise<Hex> {
    requireTestnet(deps);
    if (!deps.getAddress()) throw new Error("Connect a wallet first.");
    return deps.writeContract({
      address: MEZO.borrowerOperations, abi: borrowerOperationsAbi, functionName: "closeTrove",
      chainId: mezoTestnet.id,
    });
  }

  return { depositWithPermit, sendWithPermit, borrowToGoal, addCollateral, repayLoan, closeLoan };
}

export function useMezoActions() {
  const { address } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const chainRef = useRef(chainId);
  const addressRef = useRef(address);
  chainRef.current = chainId;
  addressRef.current = address;

  return createPocketActions({
    getChainId: () => chainRef.current,
    getAddress: () => addressRef.current,
    readContract: (args) => {
      if (!client) return Promise.reject(new Error("Connect a wallet first."));
      return client.readContract(args as never);
    },
    signTypedData: (args) => signTypedDataAsync(args as never),
    writeContract: (args) => writeContractAsync(args as never),
    waitForReceipt: async (hash) => {
      if (!client) throw new Error("APPROVAL_UNCONFIRMED");
      const receipt = await client.waitForTransactionReceipt({ hash });
      return { status: receipt.status };
    },
  });
}
