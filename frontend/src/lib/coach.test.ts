import { describe, expect, it } from "vitest";
import { buildPlan, parseGoal } from "./coach";
import { liquidationPrice, maxBorrowAt, ratio, ratioAfterBorrow, band } from "./risk";

const NOW = new Date(2026, 9, 24); // 24 Oct 2026

describe("risk math (Mezo MUSD loans)", () => {
  const t = { coll: 0.04, debt: 2001.9 };
  const price = 81_410;
  it("ratio and liquidation price match the testnet trove we used", () => {
    expect(ratio(t, price)).toBeCloseTo(1.6267, 3);
    expect(liquidationPrice(t)).toBeCloseTo(55_052, 0);
    expect(band(ratio(t, price))).toBe("watch");
  });
  it("max borrow lands exactly on the target ratio", () => {
    const m = maxBorrowAt({ coll: 0.1, debt: 2000 }, 80_000, 2);
    expect(m).toBeGreaterThan(1990);
    expect(ratioAfterBorrow({ coll: 0.1, debt: 2000 }, 80_000, m)).toBeGreaterThanOrEqual(2);
  });
  it("never suggests a negative borrow", () => {
    expect(maxBorrowAt(t, price, 2)).toBe(0);
  });
});

describe("parseGoal", () => {
  it("amount + month", () => {
    const p = parseGoal("I want to save 1,200 for a trip to Goa by March", NOW);
    expect(p.name).toBe("Travel");
    expect(p.target).toBe(1200);
    expect(p.days).toBe(128); // 24 Oct → 1 Mar
  });
  it("months of rent", () => {
    const p = parseGoal("emergency fund of 3 months of rent at 800", NOW);
    expect(p.name).toBe("Emergency fund");
    expect(p.target).toBe(2400);
  });
  it("weekly amount + duration fills the target", () => {
    const p = parseGoal("put away 50 a week for a laptop over 10 weeks", NOW);
    expect(p.name).toBe("New laptop");
    expect(p.days).toBe(70);
    expect(p.target).toBe(500);
  });
  it("target + monthly amount fills the date", () => {
    const p = parseGoal("school fees 3k, I can do 500 per month", NOW);
    expect(p.name).toBe("School fees");
    expect(p.target).toBe(3000);
    expect(p.days).toBe(183);
  });
  it("caps at two years and ignores the year as an amount", () => {
    const p = parseGoal("house deposit 10k by Jan 2030", NOW);
    expect(p.target).toBe(10_000);
    expect(p.days).toBe(730);
  });
  it("custom names from 'for …'", () => {
    expect(parseGoal("save 300 for Mum's surgery in 2 months", NOW).name).toBe("Mum's surgery");
    expect(parseGoal("save 300 for Lisbon conference in 2 months", NOW).name).toBe("Lisbon conference");
  });
});

describe("buildPlan", () => {
  const goal = parseGoal("save 1,200 for a trip by March", NOW);
  it("wallet first, then a weekly schedule when there is no loan", () => {
    const plan = buildPlan(goal, { walletMusd: 200, now: NOW, price: 80_000 });
    expect(plan.steps.map((s) => s.kind)).toEqual(["wallet", "swap", "schedule"]);
    expect(plan.steps[0].amount).toBe(200);
  });
  it("borrows from a healthy trove but only down to 200%", () => {
    const plan = buildPlan(goal, { walletMusd: 0, now: NOW, price: 80_000, trove: { coll: 0.1, debt: 2000 } });
    const borrow = plan.steps.find((s) => s.kind === "borrow");
    expect(borrow?.amount).toBe(1200);
    expect(plan.risk!.after).toBeGreaterThanOrEqual(2);
    expect(plan.risk!.after).toBeLessThan(plan.risk!.now);
  });
  it("refuses to plan a borrow for a loan that is already tight", () => {
    const plan = buildPlan(goal, { walletMusd: 0, now: NOW, price: 81_410, trove: { coll: 0.04, debt: 2001.9 } });
    expect(plan.steps.some((s) => s.kind === "borrow")).toBe(false);
    expect(plan.warnings.join(" ")).toMatch(/200%/);
  });
  it("suggests opening a loan only above Mezo's 1,800 MUSD minimum", () => {
    const big = buildPlan(parseGoal("home deposit 5000 in 1 year", NOW), { walletMusd: 0, now: NOW, price: 80_000 });
    expect(big.steps.some((s) => s.kind === "open-loan")).toBe(true);
  });
  it("is deterministic", () => {
    const a = buildPlan(goal, { walletMusd: 10, now: NOW, price: 80_000 });
    const b = buildPlan(goal, { walletMusd: 10, now: NOW, price: 80_000 });
    expect(a).toEqual(b);
  });
});
