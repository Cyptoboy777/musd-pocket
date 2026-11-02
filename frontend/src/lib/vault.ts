import { createPublicClient, http, type Address, type Hex } from "viem";
import { mezoTestnet } from "./chains";
import { SAVINGS_VAULT } from "./proof";

/** Documented mainnet sMUSD vault address (also checked on the connected chain). */
export const SMUSD_VAULT_ADDRESS = SAVINGS_VAULT.mainnet as Address;

const vaultAbi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToShares", stateMutability: "view", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

export { vaultAbi };

/** True when the address has contract bytecode on the given chain (feature-flag gate). */
export function hasBytecode(code: Hex | undefined | null): boolean {
  return !!code && code !== "0x" && code.length > 2;
}

/**
 * Feature flag: "earn while locked" only activates when vault bytecode exists
 * on the connected chain. On Mezo testnet the documented address is empty.
 */
export async function detectVaultLive(
  rpcUrl = mezoTestnet.rpcUrls.default.http[0],
  address: Address = SMUSD_VAULT_ADDRESS,
): Promise<{ live: boolean; codeLength: number }> {
  const client = createPublicClient({ chain: mezoTestnet, transport: http(rpcUrl) });
  const code = await client.getBytecode({ address });
  const live = hasBytecode(code);
  return { live, codeLength: code && code !== "0x" ? (code.length - 2) / 2 : 0 };
}
