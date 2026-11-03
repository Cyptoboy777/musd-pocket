declare module "@mezo-org/orangekit" {
  import type { Wallet } from "@rainbow-me/rainbowkit";

  export type ConnectorConfig = {
    rpcUrl: string;
    chainId: number;
    relayApiKey?: string;
    relayConfig?: unknown;
  };

  export type CreateWalletFn = () => Wallet;

  export function getUnisatWallet(config: ConnectorConfig): CreateWalletFn;
  export function getXverseWallet(config: ConnectorConfig): CreateWalletFn;
  export function getOKXWallet(config: ConnectorConfig): CreateWalletFn;
}
