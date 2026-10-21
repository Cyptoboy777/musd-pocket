import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { coinbaseWallet, injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mezoTestnet } from "./lib/chains";

/**
 * WalletConnect (mobile QR / deep links) needs a real Reown Cloud project id in
 * VITE_WC_PROJECT_ID. Without one we don't fake it: the app falls back to browser
 * wallets only (MetaMask, Rabby, Brave, OKX… discovered via EIP-6963, plus Coinbase
 * Wallet), which need no project id. Phones can use a wallet's in-app browser.
 */
const wcProjectId = (import.meta.env.VITE_WC_PROJECT_ID as string | undefined)?.trim() || "";
export const walletConnectEnabled = wcProjectId.length > 0;

const appName = "MUSD Pocket";
const transports = { [mezoTestnet.id]: http() };

export const config = walletConnectEnabled
  ? getDefaultConfig({ appName, projectId: wcProjectId, chains: [mezoTestnet], transports, ssr: false })
  : createConfig({
      chains: [mezoTestnet],
      transports,
      connectors: connectorsForWallets(
        [{ groupName: "Browser wallets", wallets: [injectedWallet, coinbaseWallet] }],
        // Not used by these wallets; RainbowKit's type requires a string.
        { appName, projectId: "walletconnect-disabled" },
      ),
      ssr: false,
    });
