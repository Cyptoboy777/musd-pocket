import { FACTS } from "./facts";

/**
 * Mezo mainnet dependencies from facts.json.
 * Chain and RPC: https://mezo.org/docs/developers/getting-started/
 * MUSD: https://mezo.org/docs/users/resources/contracts-reference/
 * Protocol proxies: https://github.com/mezo-org/musd/releases/tag/v1.1.0
 * Pocket has no mainnet address until facts.json mainnet.pocket is set.
 */
export const MAINNET_POCKET_DEPS = {
  chainId: FACTS.mainnet.chainId,
  musd: FACTS.mainnet.musd,
  borrowerOperations: FACTS.mainnet.borrowerOperations,
  borrowerOpsSignatures: FACTS.mainnet.borrowerOpsSignatures,
  troveManager: FACTS.mainnet.troveManager,
  priceFeed: FACTS.mainnet.priceFeed,
} as const;

/** Null until a real deployment address is written into facts.json. */
export const POCKET_MAINNET_ADDRESS: `0x${string}` | null = FACTS.mainnet.pocket;

export function mainnetPocketConfigured(): boolean {
  return POCKET_MAINNET_ADDRESS !== null;
}

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
