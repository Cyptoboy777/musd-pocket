import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FACTS } from "./facts";
import { isDeployToolPath, isPreviewDeployTool } from "./deployGate";
import {
  BORROWER_OPERATIONS,
  CREATION_BYTECODE,
  MEZO_MAINNET_CHAIN_HEX,
  MEZO_MAINNET_CHAIN_ID,
  POCKET_CONSTRUCTOR,
  compareReadback,
  constructorArgs,
  decodePocketDeployArgs,
  deployErrorCopy,
  encodePocketDeploy,
  formatBtcFromWei,
  mainnetDeployAllowed,
  mezoMainnetWalletParams,
  parseOwner,
} from "./deployMainnet";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
/** cast abi-encode for the five constructor arguments and this owner. */
const ENCODED_ARGS =
  "0x000000000000000000000000dd468a1ddc392dcdbef6db6e34e89aa338f9f186000000000000000000000000b57ab578bf20b3e318f3efaa587c51dbcce5df7a00000000000000000000000094afb503dbca74ac3e4929baceedfce19b93c193000000000000000000000000c5ac5a8892230e0a3e1c473881a2de7353ffca880000000000000000000000001111111111111111111111111111111111111111";

describe("mainnet deploy encoding", () => {
  it("uses the documented mainnet addresses and leaves pocket unset", () => {
    expect(FACTS.mainnet.pocket).toBeNull();
    expect(POCKET_CONSTRUCTOR.musd).toBe("0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186");
    expect(POCKET_CONSTRUCTOR.borrowerOperationsSignatures).toBe("0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a");
    expect(POCKET_CONSTRUCTOR.troveManager).toBe("0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193");
    expect(POCKET_CONSTRUCTOR.priceFeed).toBe("0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88");
    expect(BORROWER_OPERATIONS).toBe("0x44b1bac67dDA612a41a58AAf779143B181dEe031");
    expect(constructorArgs(OWNER)).toEqual([
      POCKET_CONSTRUCTOR.musd,
      POCKET_CONSTRUCTOR.borrowerOperationsSignatures,
      POCKET_CONSTRUCTOR.troveManager,
      POCKET_CONSTRUCTOR.priceFeed,
      OWNER,
    ]);
    expect(constructorArgs(OWNER)).not.toContain(BORROWER_OPERATIONS);
  });

  it("appends the cast ABI encoding to the creation bytecode", () => {
    const data = encodePocketDeploy(OWNER);
    expect(data.startsWith(CREATION_BYTECODE)).toBe(true);
    expect(data.slice(CREATION_BYTECODE.length)).toBe(ENCODED_ARGS.slice(2));
    expect(decodePocketDeployArgs(data)).toEqual([
      POCKET_CONSTRUCTOR.musd,
      POCKET_CONSTRUCTOR.borrowerOperationsSignatures,
      POCKET_CONSTRUCTOR.troveManager,
      POCKET_CONSTRUCTOR.priceFeed,
      OWNER,
    ]);
  });

  it("changes only the owner word when the owner changes", () => {
    const other = getAddress("0x2222222222222222222222222222222222222222");
    const first = encodePocketDeploy(OWNER);
    const second = encodePocketDeploy(other);
    expect(first.slice(0, CREATION_BYTECODE.length)).toBe(second.slice(0, CREATION_BYTECODE.length));
    expect(decodePocketDeployArgs(second)[4]).toBe(other);
  });
});

describe("mainnet deploy chain guard", () => {
  it("allows only Mezo mainnet", () => {
    expect(mainnetDeployAllowed(MEZO_MAINNET_CHAIN_ID)).toBe(true);
    expect(mainnetDeployAllowed(31611)).toBe(false);
    expect(mainnetDeployAllowed(1)).toBe(false);
    expect(mainnetDeployAllowed(undefined)).toBe(false);
    expect(mainnetDeployAllowed(null)).toBe(false);
    expect(Number(MEZO_MAINNET_CHAIN_HEX)).toBe(31612);
    expect(mezoMainnetWalletParams().rpcUrls).toEqual(["https://mezo.drpc.org"]);
    expect(mezoMainnetWalletParams().blockExplorerUrls).toEqual(["https://explorer.mezo.org"]);
  });

  it("is only compiled into Vercel preview builds", () => {
    expect(isPreviewDeployTool("preview")).toBe(true);
    expect(isPreviewDeployTool("production")).toBe(false);
    expect(isPreviewDeployTool("development")).toBe(false);
    expect(isPreviewDeployTool(undefined)).toBe(false);
    expect(isDeployToolPath("/deploy-tool")).toBe(true);
    expect(isDeployToolPath("/deploy-tool/")).toBe(true);
    expect(isDeployToolPath("/")).toBe(false);
    expect(isDeployToolPath("/stats")).toBe(false);
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).not.toContain("/deploy-tool");
  });
});

describe("owner checksum and readback", () => {
  it("accepts a checksummed address and rejects a bad checksum", () => {
    const sample = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const checksummed = getAddress(sample);
    expect(parseOwner(checksummed).ok && parseOwner(checksummed).ok && (parseOwner(checksummed) as { address: string }).address).toBe(checksummed);
    const lower = parseOwner(sample);
    expect(lower.ok && lower.address).toBe(checksummed);
    const flipped = checksummed.slice(0, 2) + (checksummed[2] === checksummed[2].toLowerCase() ? checksummed[2].toUpperCase() : checksummed[2].toLowerCase()) + checksummed.slice(3);
    expect(parseOwner(flipped).ok).toBe(false);
    expect(parseOwner("0x1234").ok).toBe(false);
  });

  it("compares immutables and owner without echoing raw errors", () => {
    const rows = compareReadback({
      musd: POCKET_CONSTRUCTOR.musd,
      borrowerOpsSig: POCKET_CONSTRUCTOR.borrowerOperationsSignatures.toLowerCase(),
      troveManager: "0x0000000000000000000000000000000000000001",
      priceFeed: POCKET_CONSTRUCTOR.priceFeed,
      owner: OWNER,
    }, OWNER);
    expect(rows.find((row) => row.field === "musd")?.match).toBe(true);
    expect(rows.find((row) => row.field === "borrowerOpsSig")?.match).toBe(true);
    expect(rows.find((row) => row.field === "troveManager")?.match).toBe(false);
    expect(rows.every((row) => row.match)).toBe(false);
    const copy = deployErrorCopy(new Error("viem TransactionExecutionError https://mezo.drpc.org\n    at sendTransaction"));
    expect(copy).not.toMatch(/viem|https?:|at send/i);
    expect(deployErrorCopy(new Error("User rejected the request."))).toMatch(/Nothing was sent/);
    expect(formatBtcFromWei(8146655933328n)).toBe("0.000008146655");
  });
});
