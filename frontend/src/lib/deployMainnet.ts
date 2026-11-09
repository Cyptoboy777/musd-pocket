import { decodeAbiParameters, encodeDeployData, getAddress, type Hex } from "viem";
import { FACTS } from "./facts";
import artifact from "./pocketCreationBytecode.json" with { type: "json" };

/** Mezo mainnet chain id 31612. https://mezo.org/docs/developers/getting-started/ */
export const MEZO_MAINNET_CHAIN_ID = 31612;
export const MEZO_MAINNET_CHAIN_HEX = "0x7b7c";

/**
 * Constructor arguments for MUSDPocketV2.
 * MUSD: https://mezo.org/docs/users/resources/contracts-reference/
 * Protocol proxies: https://github.com/mezo-org/musd/releases/tag/v1.1.0
 * Same values as contracts/script/DeployV2Mainnet.s.sol.
 */
export const POCKET_CONSTRUCTOR = {
  musd: FACTS.mainnet.musd as Hex,
  borrowerOperationsSignatures: FACTS.mainnet.borrowerOpsSignatures as Hex,
  troveManager: FACTS.mainnet.troveManager as Hex,
  priceFeed: FACTS.mainnet.priceFeed as Hex,
} as const;

/** Checked by the deploy script. Not a constructor argument. */
export const BORROWER_OPERATIONS = FACTS.mainnet.borrowerOperations as Hex;

export const CREATION_BYTECODE = artifact.bytecode as Hex;
export const CREATION_BYTECODE_HASH = artifact.bytecodeHash as Hex;

const constructorAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "musdToken", type: "address" },
      { name: "borrowerOperationsSignatures", type: "address" },
      { name: "troveManager_", type: "address" },
      { name: "priceFeed_", type: "address" },
      { name: "initialOwner", type: "address" },
    ],
  },
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

export function constructorArgs(owner: Hex): readonly [Hex, Hex, Hex, Hex, Hex] {
  return [
    POCKET_CONSTRUCTOR.musd,
    POCKET_CONSTRUCTOR.borrowerOperationsSignatures,
    POCKET_CONSTRUCTOR.troveManager,
    POCKET_CONSTRUCTOR.priceFeed,
    owner,
  ];
}

/** Creation transaction data: compiled bytecode plus ABI-encoded constructor args. */
export function encodePocketDeploy(owner: Hex): Hex {
  return encodeDeployData({
    abi: constructorAbi,
    bytecode: CREATION_BYTECODE,
    args: constructorArgs(owner),
  });
}

export function decodePocketDeployArgs(data: Hex): readonly string[] {
  const argsHex = `0x${data.slice(CREATION_BYTECODE.length)}` as Hex;
  const decoded = decodeAbiParameters(constructorAbi[0].inputs, argsHex);
  return decoded.map((value) => String(value));
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
  borrowerOpsSig?: string | null;
  troveManager?: string | null;
  priceFeed?: string | null;
  owner?: string | null;
};

export function compareReadback(read: Readback, owner: Hex): { field: string; expected: string; actual: string; match: boolean }[] {
  const rows: { field: string; expected: string; actual: string | null | undefined }[] = [
    { field: "musd", expected: POCKET_CONSTRUCTOR.musd, actual: read.musd },
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
