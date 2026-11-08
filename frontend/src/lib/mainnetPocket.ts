/** Expected Mezo mainnet dependencies. Pocket itself has no verified mainnet address. */
export const MAINNET_POCKET_DEPS = {
  chainId: 31612,
  musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
  borrowerOpsSignatures: "0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a",
  troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
  priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
} as const;

/** Unset until a sponsored deployment is proven on chain 31612. */
export const POCKET_MAINNET_ADDRESS: null = null;

function same(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/**
 * True only when a later deployment's code and immutable reads match mainnet MUSD.
 * An empty or mismatched address stays off. This does not enable writes by itself.
 */
export function mainnetPocketReady(input: {
  chainId?: number | null;
  address?: string | null;
  code?: string | null;
  musd?: string | null;
  borrowerOpsSignatures?: string | null;
  troveManager?: string | null;
  priceFeed?: string | null;
}): boolean {
  if (input.chainId !== MAINNET_POCKET_DEPS.chainId) return false;
  if (!input.address || !input.code || input.code === "0x" || input.code.length <= 2) return false;
  return same(input.musd, MAINNET_POCKET_DEPS.musd)
    && same(input.borrowerOpsSignatures, MAINNET_POCKET_DEPS.borrowerOpsSignatures)
    && same(input.troveManager, MAINNET_POCKET_DEPS.troveManager)
    && same(input.priceFeed, MAINNET_POCKET_DEPS.priceFeed);
}
