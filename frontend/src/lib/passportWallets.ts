import type { WalletList } from "@rainbow-me/rainbowkit";
import { getOKXWallet, getUnisatWallet, getXverseWallet } from "@mezo-org/orangekit";
import { mezoTestnet } from "./chains";

/**
 * Mezo Passport / OrangeKit BTC wallets for RainbowKit.
 * Official OrangeKit exports Unisat, Xverse, and OKX — not Leather
 * (Leather is absent from @mezo-org/orangekit and @mezo-org/passport dists).
 * Mezo testnet (31611) uses MezoTransactionSender; no Gelato relayApiKey required.
 */
export const MEZO_PASSPORT_GROUP = "Bitcoin (Mezo Passport)" as const;

export const PASSPORT_BTC_WALLET_IDS = [
  "orangekit-unisat",
  "orangekit-xverse",
  "orangekit-okx",
] as const;

export type PassportBtcWalletId = (typeof PASSPORT_BTC_WALLET_IDS)[number];

export function mezoPassportConnectorConfig() {
  const rpcUrl = mezoTestnet.rpcUrls.default.http[0];
  if (!rpcUrl) throw new Error("Mezo testnet RPC URL missing");
  return { rpcUrl, chainId: mezoTestnet.id };
}

/** RainbowKit CreateWalletFn factories from OrangeKit (Passport connector layer). */
export function getPassportBtcWallets() {
  const config = mezoPassportConnectorConfig();
  return [getUnisatWallet(config), getXverseWallet(config), getOKXWallet(config)] as const;
}

export function getPassportWalletGroup(): WalletList[number] {
  return {
    groupName: MEZO_PASSPORT_GROUP,
    wallets: [...getPassportBtcWallets()],
  };
}

/** Display names shown in the connect modal (OrangeKit prefixes with "OrangeKit "). */
export function passportSupportedWalletNames(): string[] {
  return ["Unisat", "Xverse", "OKX"];
}

export function isPassportBtcWalletId(id: string): id is PassportBtcWalletId {
  return (PASSPORT_BTC_WALLET_IDS as readonly string[]).includes(id);
}
