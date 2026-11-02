import { useAccount, useBalance, usePublicClient, useReadContracts, useSignTypedData, useWriteContract } from "wagmi";
import { formatUnits, parseSignature, parseUnits, type Hex } from "viem";
import { MEZO, MEZO_TOKEN, MUSD_ADDRESS, POCKET_ADDRESS, mezoTestnet } from "./chains";
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

export function useMezoActions() {
  const { address } = useAccount();
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  /** EIP-2612 permit for exactly `amount`, signed off-chain (no gas, no approval tx). */
  async function permit(amount: bigint) {
    if (!address || !client) throw new Error("Connect a wallet first.");
    const nonce = await client.readContract({ address: MUSD_ADDRESS, abi: permitAbi, functionName: "nonces", args: [address] });
    const deadline = EIP712_DEADLINE();
    const sig = await signTypedDataAsync({
      domain: { name: "Mezo USD", version: "1", chainId: mezoTestnet.id, verifyingContract: MUSD_ADDRESS },
      types: { Permit: [
        { name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
      ] },
      primaryType: "Permit",
      message: { owner: address, spender: POCKET_ADDRESS, value: amount, nonce, deadline },
    });
    const { r, s, v, yParity } = parseSignature(sig);
    return { deadline, r, s, v: Number(v ?? BigInt(27 + (yParity ?? 0))) };
  }

  async function depositWithPermit(goalId: bigint, amountStr: string): Promise<Hex> {
    const amount = parseUnits(amountStr, 18);
    const p = await permit(amount);
    return writeContractAsync({
      address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "depositWithPermit",
      args: [goalId, amount, p.deadline, p.v, p.r, p.s], chainId: mezoTestnet.id,
    });
  }

  async function sendWithPermit(to: `0x${string}`, amountStr: string, memo: string): Promise<Hex> {
    const amount = parseUnits(amountStr, 18);
    const p = await permit(amount);
    return writeContractAsync({
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
    if (!address || !client) throw new Error("Connect a wallet first.");
    const amount = parseUnits(amountStr, 18);
    // Re-read trove + price at send time: BTC moves, and stale UI math can understate debt.
    const [status, dc, priceRaw] = await Promise.all([
      client.readContract({ address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [address] }),
      client.readContract({ address: MEZO.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [address] }),
      client.readContract({ address: MEZO.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" }),
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

    const [hint] = await client.readContract({
      address: MEZO.hintHelpers, abi: hintHelpersAbi, functionName: "getApproxHint",
      args: [nicr, 15n, BigInt(Math.floor(Math.random() * 1e9))],
    });
    const [upper, lower] = await client.readContract({
      address: MEZO.sortedTroves, abi: sortedTrovesAbi, functionName: "findInsertPosition", args: [nicr, hint, hint],
    });
    const nonce = await client.readContract({ address: MEZO.borrowerOpsSignatures, abi: bosAbi, functionName: "getNonce", args: [address] });
    const deadline = EIP712_DEADLINE();
    const signature = await signTypedDataAsync({
      domain: { name: "BorrowerOperationsSignatures", version: "1", chainId: mezoTestnet.id, verifyingContract: MEZO.borrowerOpsSignatures },
      types: { WithdrawMUSD: [
        { name: "amount", type: "uint256" }, { name: "borrower", type: "address" }, { name: "recipient", type: "address" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
      ] },
      primaryType: "WithdrawMUSD",
      message: { amount, borrower: address, recipient: POCKET_ADDRESS, nonce, deadline },
    });
    return writeContractAsync({
      address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "borrowToGoal",
      args: [goalId, amount, upper, lower, signature, deadline], chainId: mezoTestnet.id,
    });
  }

  return { depositWithPermit, sendWithPermit, borrowToGoal };
}
