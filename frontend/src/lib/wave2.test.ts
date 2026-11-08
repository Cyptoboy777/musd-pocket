import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProofPanel } from "../components/ProofPanel";
import {
  ratioAfterAddColl, ratioAfterRepay, needsProtection, protectLevel, ratio, liquidationPrice,
} from "./risk";
import { parseInvite, buildInviteUrl, isInviteLanding } from "./invite";
import { hasBytecode } from "./vault";
import { cycleLang, loadLang, t, type Lang } from "./i18n";
import {
  chunkBlockRange,
  earlyFeeAmount,
  earlyFeePreview,
  fetchInBlockChunks,
  isTeamTestWallet,
  MEZO_LOG_BLOCK_DISTANCE,
  recentEventsFromBlock,
  RECENT_EVENTS_LOOKBACK,
  shareIntents,
  TEAM_TEST_WALLETS,
} from "./stats";
import { COMMUNITY_TESTERS, PROOF_WALLETS } from "./proof";
import { MEZO_MAINNET_CHAIN_ID, mezoTestnet, pocketWritesAllowed } from "./chains";
import { humanizeError } from "../hooks/useTxFeedback";
import {
  MEZO_PASSPORT_GROUP,
  PASSPORT_BTC_WALLET_IDS,
  getPassportWalletGroup,
  isPassportBtcWalletId,
  mezoPassportConnectorConfig,
  passportSupportedWalletNames,
} from "./passportWallets";

describe("protect math", () => {
  const t0 = { coll: 0.04, debt: 2000 };
  const price = 80_000;
  it("addColl raises ICR and lowers liq price pressure", () => {
    const before = ratio(t0, price);
    const after = ratioAfterAddColl(t0, price, 0.01);
    expect(after).toBeGreaterThan(before);
    expect(liquidationPrice({ coll: 0.05, debt: 2000 })).toBeLessThan(liquidationPrice(t0));
  });
  it("repay raises ICR", () => {
    expect(ratioAfterRepay(t0, price, 200)).toBeGreaterThan(ratio(t0, price));
  });
  it("needsProtection below comfort", () => {
    expect(needsProtection(1.6)).toBe(true);
    expect(needsProtection(2.1)).toBe(false);
    expect(protectLevel(1.2)).toBe("danger");
    expect(protectLevel(1.7)).toBe("watch");
    expect(protectLevel(2.2)).toBe("ok");
  });
});

describe("invite links", () => {
  it("parses invite query", () => {
    expect(parseInvite("?invite=3")).toEqual({ goalId: 3n, owner: undefined });
    expect(parseInvite("?g=12&owner=0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA")?.goalId).toBe(12n);
    expect(parseInvite("")).toBeNull();
    expect(parseInvite("?invite=0")).toBeNull();
  });
  it("builds shareable URL", () => {
    const u = buildInviteUrl("https://musd-pocket-mezo.vercel.app/", 7n);
    expect(u).toContain("invite=7");
    expect(u).toContain("#invite");
    expect(isInviteLanding("?invite=7")).toBe(true);
  });
});

describe("network gate", () => {
  it("allows savings writes only on Mezo testnet", () => {
    expect(pocketWritesAllowed(mezoTestnet.id)).toBe(true);
    expect(pocketWritesAllowed(MEZO_MAINNET_CHAIN_ID)).toBe(false);
    expect(pocketWritesAllowed(1)).toBe(false);
    expect(pocketWritesAllowed(undefined)).toBe(false);
  });
  it("keeps wallet errors free of internal detail", () => {
    const raw = humanizeError(new Error("viem ContractFunctionExecutionError https://rpc.test.mezo.org eth_call"));
    expect(raw).not.toMatch(/viem|eth_|rpc\.|https?:/i);
    expect(humanizeError(new Error("POCKET_TESTNET_ONLY"))).toMatch(/Mezo testnet/);
    expect(humanizeError(new Error("User rejected the request."))).toMatch(/declined/);
    expect(humanizeError(new Error("viem TransactionExecutionError"))).not.toMatch(/Nothing was sent/);
  });
});

describe("sMUSD feature flag", () => {
  it("empty bytecode stays off", () => {
    expect(hasBytecode(undefined)).toBe(false);
    expect(hasBytecode("0x")).toBe(false);
    expect(hasBytecode("0x608060")).toBe(true);
  });
});

describe("global i18n", () => {
  it("defaults to English and cycles global langs only", () => {
    expect(t("en", "protectTitle")).toBe("Protect my loan");
    expect(t("es", "protectTitle")).toContain("préstamo");
    expect(t("zh", "inviteChip")).toBe("存入");
    let lang: Lang = "en";
    const seen = new Set<Lang>();
    for (let i = 0; i < 5; i++) { lang = cycleLang(lang); seen.add(lang); }
    expect(seen.has("en")).toBe(true);
    expect(seen.has("es")).toBe(true);
    expect([...seen].some((x) => x === ("hi" as Lang))).toBe(false);
  });
  it("loadLang falls back to en without storage noise", () => {
    expect(["en", "es", "pt", "zh", "fr"]).toContain(loadLang());
  });
});

describe("early fee math", () => {
  it("matches contract bps division", () => {
    expect(earlyFeeAmount(1000n * 10n ** 18n, 200)).toBe(20n * 10n ** 18n);
    expect(earlyFeeAmount(0n, 200)).toBe(0n);
    const p = earlyFeePreview(1000, 200);
    expect(p.fee).toBeCloseTo(20, 8);
    expect(p.net).toBeCloseTo(980, 8);
    expect(p.pct).toBe(2);
  });
});

describe("team test wallet labels", () => {
  it("labels known builder wallets only", () => {
    expect(TEAM_TEST_WALLETS.length).toBeGreaterThanOrEqual(5);
    expect(isTeamTestWallet("0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA")).toBe(true);
    expect(isTeamTestWallet("0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA".toLowerCase())).toBe(true);
    expect(isTeamTestWallet("0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("lists one outside community tester apart from team wallets", () => {
    const addr = "0x63EfDF0633a5Cf057103CcB7dd657C9bd7AEd2d1";
    const createGoal = "0x25051be7bd23ca4751d13723410bcc16e983614ec6327545f26efbed2ed73fc2";
    expect(COMMUNITY_TESTERS).toHaveLength(1);
    expect(COMMUNITY_TESTERS[0]?.label).toBe("Community tester");
    expect(COMMUNITY_TESTERS[0]?.address).toBe(addr);
    expect(COMMUNITY_TESTERS[0]?.txs).toEqual([
      { label: "createGoal #10 Emergency fund", hash: createGoal },
    ]);
    expect(isTeamTestWallet(addr)).toBe(false);
    expect(PROOF_WALLETS.some((w) => w.address.toLowerCase() === addr.toLowerCase())).toBe(false);
    expect(TEAM_TEST_WALLETS.some((w) => w.toLowerCase() === addr.toLowerCase())).toBe(false);
  });

  it("shows the community tester on the Proof page and hides the empty state", () => {
    const html = renderToStaticMarkup(createElement(ProofPanel));
    expect(html).toContain("Community testers");
    expect(html).toContain("Community tester");
    expect(html).toContain("Emergency fund");
    expect(html).toContain("https://explorer.test.mezo.org/address/0x63EfDF0633a5Cf057103CcB7dd657C9bd7AEd2d1");
    expect(html).toContain("https://explorer.test.mezo.org/tx/0x25051be7bd23ca4751d13723410bcc16e983614ec6327545f26efbed2ed73fc2");
    expect(html).toContain("createGoal #10 Emergency fund");
    expect(html).toContain('data-feature="community-testers"');
    expect(html).not.toContain("No third-party testers yet");
    expect(html).not.toContain("community-testers-empty");
    expect(html).toContain("My own test wallets");
  });
});

describe("share intents", () => {
  it("builds X Telegram WhatsApp and copy entries", () => {
    const intents = shareIntents("https://musd-pocket-mezo.vercel.app/?invite=6", "Chip in");
    expect(intents.map((i) => i.id)).toEqual(["x", "telegram", "whatsapp", "copy", "native"]);
    expect(intents.find((i) => i.id === "x")?.href).toContain("twitter.com/intent/tweet");
    expect(intents.find((i) => i.id === "telegram")?.href).toContain("t.me/share");
    expect(intents.find((i) => i.id === "whatsapp")?.href).toContain("wa.me");
  });
});

describe("i18n wave2 upgrade keys", () => {
  it("covers tabs empty states stats and fee preview in all langs", () => {
    const langs: Lang[] = ["en", "es", "pt", "zh", "fr"];
    for (const lang of langs) {
      expect(t(lang, "tabPockets").length).toBeGreaterThan(0);
      expect(t(lang, "emptyConnectTitle").length).toBeGreaterThan(0);
      expect(t(lang, "earlyFeePreview").length).toBeGreaterThan(0);
      expect(t(lang, "statsTitle").length).toBeGreaterThan(0);
      expect(t(lang, "statsEventsError").length).toBeGreaterThan(0);
      expect(t(lang, "statsEventsError")).not.toMatch(/eth_getLogs|viem|Missing or invalid/i);
      expect(t(lang, "vaultNotLive")).not.toMatch(/eth_getCode|bytecode|honest empty|no code/i);
      expect(t(lang, "networkMainnet").length).toBeGreaterThan(0);
      expect(t(lang, "statsReadError")).not.toMatch(/rpc\.|https?:/i);
      expect(t(lang, "closeNeedMusd").length).toBeGreaterThan(0);
      expect(t(lang, "heroExample").length).toBeGreaterThan(0);
    }
  });
});


describe("mezo log ranges", () => {
  it("keeps every eth_getLogs span within the 10_000-block limit", () => {
    expect(chunkBlockRange(0n, 10_000n)).toEqual([{ fromBlock: 0n, toBlock: 10_000n }]);
    expect(chunkBlockRange(0n, 10_001n)).toEqual([
      { fromBlock: 0n, toBlock: 10_000n },
      { fromBlock: 10_001n, toBlock: 10_001n },
    ]);
    const latest = 16_589_540n;
    const from = recentEventsFromBlock(latest);
    expect(from).toBe(latest - RECENT_EVENTS_LOOKBACK);
    const ranges = chunkBlockRange(from, latest);
    expect(ranges.length).toBeGreaterThan(1);
    expect(ranges[0]?.fromBlock).toBe(from);
    expect(ranges.at(-1)?.toBlock).toBe(latest);
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]!;
      expect(range.toBlock - range.fromBlock <= MEZO_LOG_BLOCK_DISTANCE).toBe(true);
      if (i > 0) expect(range.fromBlock).toBe(ranges[i - 1]!.toBlock + 1n);
    }
  });

  it("fetches a wide window as legal pages and keeps chunk order", async () => {
    const seen: bigint[] = [];
    const rows = await fetchInBlockChunks(0n, 25_000n, async (range) => {
      if (range.toBlock - range.fromBlock > MEZO_LOG_BLOCK_DISTANCE) {
        throw new Error("range exceeds Mezo eth_getLogs limit");
      }
      seen.push(range.fromBlock);
      return [range.fromBlock];
    });
    expect(seen).toEqual([0n, 10_001n, 20_002n]);
    expect(rows).toEqual(seen);
  });

  it("returns nothing when the window is inverted", async () => {
    expect(chunkBlockRange(5n, 4n)).toEqual([]);
    expect(recentEventsFromBlock(100n, 200n)).toBe(0n);
    await expect(fetchInBlockChunks(5n, 4n, async () => ["x"])).resolves.toEqual([]);
  });
});

describe("passport wallets", () => {
  it("targets Mezo testnet without a relay key", () => {
    const cfg = mezoPassportConnectorConfig();
    expect(cfg.chainId).toBe(31611);
    expect(cfg.rpcUrl).toContain("test.mezo.org");
  });
  it("exposes Unisat, Xverse, and OKX (no Leather in OrangeKit)", () => {
    expect(passportSupportedWalletNames()).toEqual(["Unisat", "Xverse", "OKX"]);
    expect(PASSPORT_BTC_WALLET_IDS).toHaveLength(3);
    expect(isPassportBtcWalletId("orangekit-unisat")).toBe(true);
    expect(isPassportBtcWalletId("leather")).toBe(false);
  });
  it("builds a RainbowKit wallet group with factory fns", () => {
    const group = getPassportWalletGroup();
    expect(group.groupName).toBe(MEZO_PASSPORT_GROUP);
    expect(group.wallets).toHaveLength(3);
    for (const w of group.wallets) expect(typeof w).toBe("function");
  });
});
