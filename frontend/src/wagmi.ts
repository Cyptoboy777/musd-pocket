import { connectorsForWallets, getDefaultConfig, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { coinbaseWallet, injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mezoMainnet, mezoTestnet, walletChains } from "./lib/chains";
import { getPassportWalletGroup } from "./lib/passportWallets";

/**
 * WalletConnect (mobile QR / deep links) needs a real Reown Cloud project id in
 * VITE_WC_PROJECT_ID. Without one we don't fake it: the app falls back to browser
 * wallets only (MetaMask, Rabby, Brave, OKX… discovered via EIP-6963, plus Coinbase
 * Wallet), which need no project id. Phones can use a wallet's in-app browser.
 *
 * Bitcoin wallets (Unisat / Xverse / OKX) come from Mezo OrangeKit — the connector
 * layer behind Mezo Passport — and sit in their own RainbowKit group so EVM connect
 * stays intact.
 */
const wcProjectId = (import.meta.env.VITE_WC_PROJECT_ID as string | undefined)?.trim() || "";
export const walletConnectEnabled = wcProjectId.length > 0;

const appName = "MUSD Pocket";
const chains = walletChains();
const transports = chains.length === 1
  ? { [mezoTestnet.id]: http() }
  : { [mezoTestnet.id]: http(), [mezoMainnet.id]: http(mezoMainnet.rpcUrls.default.http[0]) };
const passportGroup = getPassportWalletGroup();

export const config = walletConnectEnabled
  ? getDefaultConfig({
      appName,
      projectId: wcProjectId,
      chains,
      transports,
      ssr: false,
      wallets: [passportGroup, ...getDefaultWallets().wallets],
    })
  : createConfig({
      chains,
      transports,
      connectors: connectorsForWallets(
        [
          passportGroup,
          { groupName: "Browser wallets", wallets: [injectedWallet, coinbaseWallet] },
        ],
        // Not used by these wallets; RainbowKit's type requires a string.
        { appName, projectId: "walletconnect-disabled" },
      ),
      ssr: false,
    });
