import { defineChain } from "viem";
import { FACTS, MUSD_TESTNET_ADDRESS, POCKET_V1_ADDRESS as POCKET_V1_FACT, POCKET_V2_ADDRESS } from "./facts";
import { POCKET_MAINNET_ADDRESS } from "./mainnetPocket";

/** Mezo Testnet — https://mezo.org/docs/developers/getting-started/ */
export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.test.mezo.org"],
      webSocket: ["wss://rpc-ws.test.mezo.org"],
    },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
  testnet: true,
});

/**
 * Mezo mainnet. Chain id, gas token, and public RPCs:
 * https://mezo.org/docs/developers/getting-started/
 * Added to the wallet only when facts.json has a Pocket address.
 */
export const mezoMainnet = defineChain({
  id: FACTS.mainnet.chainId,
  name: "Mezo",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: FACTS.mainnet.decimals },
  rpcUrls: {
    default: {
      http: [FACTS.mainnet.rpc],
      webSocket: [FACTS.mainnet.rpcWs],
    },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: FACTS.mainnet.explorer },
  },
});

/** Mezo mainnet chain id. Savings writes stay on testnet. */
export const MEZO_MAINNET_CHAIN_ID = mezoMainnet.id;

/**
 * Savings transactions go to the testnet pocket.
 * facts.json mainnet.pocket is the flag for offering Mezo mainnet in the wallet.
 * It does not retarget these writes. The signing domain and Mezo contracts in
 * this app are the testnet ones until that wiring is done after a real deploy.
 */
export function pocketWritesAllowed(chainId: number | undefined): boolean {
  return chainId === mezoTestnet.id;
}

/** Chains offered to the wallet. Mainnet is omitted until a Pocket address exists. */
export function walletChains() {
  return POCKET_MAINNET_ADDRESS === null
    ? ([mezoTestnet] as const)
    : ([mezoTestnet, mezoMainnet] as const);
}

/** Canonical MUSD on Mezo testnet. https://mezo.org/docs/users/resources/contracts-reference/ */
export const MUSD_ADDRESS = MUSD_TESTNET_ADDRESS;

/**
 * MUSD Pocket v2 on Mezo testnet. The verified bytecode is git 2c5bd9b.
 * A local override may replace it for experiments. The default is facts.json.
 */
export const POCKET_ADDRESS = (
  import.meta.env.VITE_POCKET_ADDRESS || POCKET_V2_ADDRESS
) as `0x${string}`;

/** Wave 1 contract, kept so old explorer links still resolve. */
export const POCKET_V1_ADDRESS = POCKET_V1_FACT;

/** MEZO token (precompile) on Mezo testnet. */
export const MEZO_TOKEN = "0x7B7c000000000000000000000000000000000001" as const;

/**
 * Mezo's MUSD protocol on testnet (github.com/mezo-org/musd). Each address was checked
 * on-chain: BorrowerOperations.borrowerOperationsSignaturesAddress(), TroveManager.sortedTroves(), …
 */
export const MEZO = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  borrowerOpsSignatures: "0xD757e3646AF370b15f32EB557F0F8380Df7D639e",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
} as const;
