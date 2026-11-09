import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MUSD_ADDRESS, POCKET_ADDRESS, mezoTestnet, walletChains } from "./chains";
import { FACTS, LIVE_APP } from "./facts";
import { POCKET_MAINNET_ADDRESS } from "./mainnetPocket";

const root = new URL("../../../", import.meta.url);

function text(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

const currentDocs = [
  "README.md",
  "SUBMISSION.md",
  "wave2-submission.md",
  "docs/TESTER-GUIDE.md",
  "docs/DEPLOY_MAINNET.md",
  "docs/ONCHAIN-ACTIVITY.md",
  "contracts/README.md",
];

describe("facts.json", () => {
  it("is what the app uses for the live pocket", () => {
    expect(LIVE_APP).toBe(FACTS.liveUrl);
    expect(POCKET_ADDRESS.toLowerCase()).toBe(FACTS.contracts.pocketV2.toLowerCase());
    expect(MUSD_ADDRESS.toLowerCase()).toBe(FACTS.contracts.musdTestnet.toLowerCase());
    expect(POCKET_MAINNET_ADDRESS).toBeNull();
    expect(FACTS.mainnet.status).toBe("not-deployed");
    expect(FACTS.mainnet.chainId).toBe(31612);
    expect(walletChains().map((chain) => chain.id)).toEqual([mezoTestnet.id]);
  });

  it("is repeated in the current docs, without the old hosts", () => {
    for (const file of currentDocs) {
      const body = text(file);
      expect(body, file).toContain(FACTS.liveUrl);
      expect(body, file).toContain(FACTS.contracts.pocketV2);
      expect(body, file).not.toContain("musd-pocket.vercel.app");
      expect(body, file).not.toContain("github.io/musd-pocket");
    }
    const readme = text("README.md");
    expect(readme).toContain(`${FACTS.tests.foundryPassed} Foundry`);
    expect(readme).toContain(`${FACTS.tests.vitestPassed} Vitest`);
    expect(readme).toContain(`${FACTS.tests.foundrySkipped} skipped`);
  });
});
