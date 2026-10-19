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
 * Set after deploy. Override with VITE_POCKET_ADDRESS in .env
 * Default: deployed MUSDPocket on Mezo testnet (tx 0x98181dcd…1df6).
 */
export const POCKET_ADDRESS = (
  import.meta.env.VITE_POCKET_ADDRESS ||
  "0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8"
) as `0x${string}`;
