import { decodeAbiParameters, encodeDeployData, getAddress, type Hex } from "viem";
import { FACTS } from "./facts";
import artifact from "./pocketCreationBytecode.json" with { type: "json" };
import timelockArtifact from "./timelockCreationBytecode.json" with { type: "json" };

/** Mezo mainnet chain id 31612. https://mezo.org/docs/developers/getting-started/ */
export const MEZO_MAINNET_CHAIN_ID = 31612;
export const MEZO_MAINNET_CHAIN_HEX = "0x7b7c";

/**
 * Config for MUSDPocketV3 on Mezo mainnet.
 * MUSD: https://mezo.org/docs/users/resources/contracts-reference/
 * Protocol proxies: https://github.com/mezo-org/musd/releases/tag/v1.1.0
 * savingsVault (sMUSD): PCV.feeRecipient() on mainnet, also listed in mezo-org/documentation.
 * Same values as contracts/script/DeployV3Mainnet.s.sol.
 */
export const POCKET_CONSTRUCTOR = {
  musd: FACTS.mainnet.musd as Hex,
  borrowerOperations: FACTS.mainnet.borrowerOperations as Hex,
  borrowerOperationsSignatures: FACTS.mainnet.borrowerOpsSignatures as Hex,
  troveManager: FACTS.mainnet.troveManager as Hex,
  priceFeed: FACTS.mainnet.priceFeed as Hex,
  savingsVault: FACTS.mainnet.savingsVault as Hex,
} as const;

export const BORROWER_OPERATIONS = POCKET_CONSTRUCTOR.borrowerOperations;

/** Admin changes wait this long (2 days) in PocketTimelock. */
export const TIMELOCK_DELAY = 172800n;

export const CREATION_BYTECODE = artifact.bytecode as Hex;
export const CREATION_BYTECODE_HASH = artifact.bytecodeHash as Hex;
export const TIMELOCK_BYTECODE = timelockArtifact.bytecode as Hex;
export const TIMELOCK_BYTECODE_HASH = timelockArtifact.bytecodeHash as Hex;

const constructorAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "c",
        type: "tuple",
        components: [
          { name: "musd", type: "address" },
          { name: "borrowerOperations", type: "address" },
          { name: "borrowerOperationsSignatures", type: "address" },
          { name: "troveManager", type: "address" },
          { name: "priceFeed", type: "address" },
          { name: "savingsVault", type: "address" },
          { name: "owner", type: "address" },
        ],
      },
    ],
  },
] as const;

const timelockConstructorAbi = [
  { type: "constructor", inputs: [{ name: "admin_", type: "address" }, { name: "delay_", type: "uint256" }] },
] as const;

export function mainnetDeployAllowed(chainId: number | undefined | null): boolean {
  return chainId === MEZO_MAINNET_CHAIN_ID;
}

export function parseOwner(input: string): { ok: true; address: Hex } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return { ok: false, message: "Enter a 20-byte address starting with 0x." };
  }
  const body = trimmed.slice(2);
  const mixedCase = /[a-f]/.test(body) && /[A-F]/.test(body);
  try {
    const checksummed = getAddress(trimmed);
    if (mixedCase && checksummed !== trimmed) {
      return { ok: false, message: "That checksum does not match. Copy the address from MetaMask again." };
    }
    return { ok: true, address: checksummed };
  } catch {
    return { ok: false, message: "That checksum does not match. Copy the address from MetaMask again." };
  }
}

export type PocketConfig = {
  musd: Hex;
  borrowerOperations: Hex;
  borrowerOperationsSignatures: Hex;
  troveManager: Hex;
  priceFeed: Hex;
  savingsVault: Hex;
  owner: Hex;
};

/** The Pocket's owner is the timelock, never a plain wallet. */
export function constructorArgs(owner: Hex): PocketConfig {
  return { ...POCKET_CONSTRUCTOR, owner };
}

/** Creation transaction data: compiled bytecode plus the ABI-encoded Config tuple. */
export function encodePocketDeploy(owner: Hex): Hex {
  return encodeDeployData({ abi: constructorAbi, bytecode: CREATION_BYTECODE, args: [constructorArgs(owner)] });
}

export function decodePocketDeployArgs(data: Hex): readonly string[] {
  const argsHex = `0x${data.slice(CREATION_BYTECODE.length)}` as Hex;
  const [c] = decodeAbiParameters(constructorAbi[0].inputs, argsHex);
  return [c.musd, c.borrowerOperations, c.borrowerOperationsSignatures, c.troveManager, c.priceFeed, c.savingsVault, c.owner].map(String);
}

/** Step 1: the timelock that will own the Pocket. The admin is the user's own wallet. */
export function encodeTimelockDeploy(admin: Hex, delay: bigint = TIMELOCK_DELAY): Hex {
  return encodeDeployData({ abi: timelockConstructorAbi, bytecode: TIMELOCK_BYTECODE, args: [admin, delay] });
}

export function mezoMainnetWalletParams() {
  return {
    chainId: MEZO_MAINNET_CHAIN_HEX,
    chainName: "Mezo",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
    rpcUrls: [FACTS.mainnet.rpc],
    blockExplorerUrls: [FACTS.mainnet.explorer],
  };
}

export function formatBtcFromWei(wei: bigint): string {
  const negative = wei < 0n;
  const value = negative ? -wei : wei;
  const whole = value / 10n ** 18n;
  const frac = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 12).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

export type Readback = {
  musd?: string | null;
  borrowerOps?: string | null;
  savingsVault?: string | null;
  borrowerOpsSig?: string | null;
  troveManager?: string | null;
  priceFeed?: string | null;
  owner?: string | null;
};

export function compareReadback(read: Readback, owner: Hex): { field: string; expected: string; actual: string; match: boolean }[] {
  const rows: { field: string; expected: string; actual: string | null | undefined }[] = [
    { field: "musd", expected: POCKET_CONSTRUCTOR.musd, actual: read.musd },
    { field: "borrowerOps", expected: POCKET_CONSTRUCTOR.borrowerOperations, actual: read.borrowerOps },
    { field: "savingsVault", expected: POCKET_CONSTRUCTOR.savingsVault, actual: read.savingsVault },
    { field: "borrowerOpsSig", expected: POCKET_CONSTRUCTOR.borrowerOperationsSignatures, actual: read.borrowerOpsSig },
    { field: "troveManager", expected: POCKET_CONSTRUCTOR.troveManager, actual: read.troveManager },
    { field: "priceFeed", expected: POCKET_CONSTRUCTOR.priceFeed, actual: read.priceFeed },
    { field: "owner", expected: owner, actual: read.owner },
  ];
  return rows.map((row) => ({
    field: row.field,
    expected: row.expected,
    actual: row.actual ?? "",
    match: !!row.actual && row.actual.toLowerCase() === row.expected.toLowerCase(),
  }));
}

export function deployErrorCopy(err: unknown): string {
  const msg = (err as { shortMessage?: string; message?: string })?.shortMessage
    || (err as { message?: string })?.message
    || "";
  if (/user rejected|denied|rejected the request|4001/i.test(msg)) {
    return "You declined the request in MetaMask. Nothing was sent.";
  }
  if (/insufficient funds/i.test(msg)) {
    return "This wallet does not have enough BTC for gas. Nothing was sent.";
  }
  return "This could not be completed. Check MetaMask and try again.";
}
