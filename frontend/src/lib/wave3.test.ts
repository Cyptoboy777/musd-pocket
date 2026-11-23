import { describe, expect, it } from "vitest";
import { closeCostWei, maxRepayWei, troveFromEntire } from "./mezo";

const e = (n: number) => BigInt(n) * 10n ** 18n;

describe("ICR view uses getEntireDebtAndColl once", () => {
  it("ignores the informational pending fields (already folded in by Mezo)", () => {
    // coll 1 BTC, principal 2,000, interest 10, pending coll 0.1, pending principal 50, pending interest 1
    const t = troveFromEntire([e(1), e(2000), e(10), e(1) / 10n, e(50), e(1)]);
    expect(t.coll).toBe(1);
    expect(t.debt).toBe(2010);
  });
});

describe("emergency repay pre-checks", () => {
  it("keeps 1,800 MUSD net debt", () => {
    // debt 2,500 = 2,300 net + 200 gas comp -> 500 repayable
    expect(maxRepayWei(e(2500), e(1800))).toBe(e(500));
  });
  it("returns 0 when the loan is already at the floor", () => {
    expect(maxRepayWei(e(2000), e(1800))).toBe(0n);
    expect(maxRepayWei(e(150), e(1800))).toBe(0n);
  });
  it("close costs debt minus the 200 MUSD gas compensation", () => {
    expect(closeCostWei(e(2500))).toBe(e(2300));
  });
});
