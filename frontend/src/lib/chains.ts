import { defineChain } from "viem";

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

/** Canonical MUSD on Mezo testnet */
export const MUSD_ADDRESS = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as const;

/**
 * MUSD Pocket v2 on Mezo testnet: borrow-to-goal, permit deposits, strict accounting.
 * Override with VITE_POCKET_ADDRESS. Deploy tx 0xa58ddba9…64f6.
 */
export const POCKET_ADDRESS = (
  import.meta.env.VITE_POCKET_ADDRESS ||
  "0xEC03F758219746b6e773f107a05cF17b66E7D460"
) as `0x${string}`;

/** Wave 1 v1 contract, kept for history (19 testnet txs). Still verified and readable. */
export const POCKET_V1_ADDRESS = "0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8" as const;

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
