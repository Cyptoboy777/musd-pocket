import { describe, expect, it } from "vitest";
import { GAUGE_ZONES, gaugeArc, gaugeFraction, gaugePoint, gaugeTone, needleDegrees } from "./gauge";

describe("loan health gauge", () => {
  it("maps 100% to the left end and 300% to the right end, and clamps outside that", () => {
    expect(gaugeFraction(1)).toBe(0);
    expect(gaugeFraction(3)).toBe(1);
    expect(gaugeFraction(2)).toBe(0.5);
    expect(gaugeFraction(0.5)).toBe(0);
    expect(gaugeFraction(9)).toBe(1);
    expect(gaugeFraction(Infinity)).toBe(1);
  });

  it("picks the colour zone from Mezo's lines: 110, 150 and 200 percent", () => {
    expect(gaugeTone(1.05)).toBe("danger");
    expect(gaugeTone(1.1)).toBe("risky");
    expect(gaugeTone(1.49)).toBe("risky");
    expect(gaugeTone(1.5)).toBe("watch");
    expect(gaugeTone(1.99)).toBe("watch");
    expect(gaugeTone(2)).toBe("ok");
    expect(gaugeTone(Infinity)).toBe("ok");
  });

  it("covers the whole range with zones that touch", () => {
    expect(GAUGE_ZONES[0].from).toBe(1);
    expect(GAUGE_ZONES[GAUGE_ZONES.length - 1].to).toBe(3);
    for (let i = 1; i < GAUGE_ZONES.length; i++) expect(GAUGE_ZONES[i].from).toBe(GAUGE_ZONES[i - 1].to);
  });

  it("puts the needle at -90, 0 and 90 degrees", () => {
    expect(needleDegrees(1)).toBe(-90);
    expect(needleDegrees(2)).toBe(0);
    expect(needleDegrees(3)).toBe(90);
  });

  it("places points on a half circle", () => {
    const left = gaugePoint(100, 100, 80, 0);
    const top = gaugePoint(100, 100, 80, 0.5);
    const right = gaugePoint(100, 100, 80, 1);
    expect(left.x).toBeCloseTo(20, 6);
    expect(left.y).toBeCloseTo(100, 6);
    expect(top.x).toBeCloseTo(100, 6);
    expect(top.y).toBeCloseTo(20, 6);
    expect(right.x).toBeCloseTo(180, 6);
    expect(gaugeArc(100, 100, 80, 0, 1)).toBe("M 20 100 A 80 80 0 0 1 180 100");
  });
});
