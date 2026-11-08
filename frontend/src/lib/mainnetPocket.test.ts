import { describe, expect, it } from "vitest";
import { MAINNET_POCKET_DEPS, POCKET_MAINNET_ADDRESS, mainnetPocketReady } from "./mainnetPocket";
import { pocketWritesAllowed, mezoTestnet } from "./chains";

const code = "0x60806040";

describe("mainnet pocket gate", () => {
  it("has no verified mainnet address and does not allow mainnet writes", () => {
    expect(POCKET_MAINNET_ADDRESS).toBeNull();
    expect(pocketWritesAllowed(MAINNET_POCKET_DEPS.chainId)).toBe(false);
    expect(pocketWritesAllowed(mezoTestnet.id)).toBe(true);
    expect(mainnetPocketReady({ chainId: 31612 })).toBe(false);
  });

  it("accepts only matching code and mainnet immutables", () => {
    expect(mainnetPocketReady({
      chainId: 31612,
      address: "0x1111111111111111111111111111111111111111",
      code,
      musd: MAINNET_POCKET_DEPS.musd,
      borrowerOpsSignatures: MAINNET_POCKET_DEPS.borrowerOpsSignatures,
      troveManager: MAINNET_POCKET_DEPS.troveManager,
      priceFeed: MAINNET_POCKET_DEPS.priceFeed,
    })).toBe(true);
    expect(mainnetPocketReady({
      chainId: 31611,
      address: "0x1111111111111111111111111111111111111111",
      code,
      musd: MAINNET_POCKET_DEPS.musd,
      borrowerOpsSignatures: MAINNET_POCKET_DEPS.borrowerOpsSignatures,
      troveManager: MAINNET_POCKET_DEPS.troveManager,
      priceFeed: MAINNET_POCKET_DEPS.priceFeed,
    })).toBe(false);
    expect(mainnetPocketReady({
      chainId: 31612,
      address: "0x1111111111111111111111111111111111111111",
      code: "0x",
      musd: MAINNET_POCKET_DEPS.musd,
      borrowerOpsSignatures: MAINNET_POCKET_DEPS.borrowerOpsSignatures,
      troveManager: MAINNET_POCKET_DEPS.troveManager,
      priceFeed: MAINNET_POCKET_DEPS.priceFeed,
    })).toBe(false);
  });
});
