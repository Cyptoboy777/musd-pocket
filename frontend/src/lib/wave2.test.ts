import { describe, expect, it } from "vitest";
import {
  ratioAfterAddColl, ratioAfterRepay, needsProtection, protectLevel, ratio, liquidationPrice,
} from "./risk";
import { parseInvite, buildInviteUrl, isInviteLanding } from "./invite";
import { hasBytecode } from "./vault";
import { cycleLang, loadLang, t, type Lang } from "./i18n";

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
