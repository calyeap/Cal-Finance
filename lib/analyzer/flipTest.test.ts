import { describe, it, expect } from "vitest";
import { evaluateFlipTest, type Step5Position } from "./flipTest";

const POSITIONS: Step5Position[] = ["CHEAP", "FAIR", "EXPENSIVE"];

describe("evaluateFlipTest", () => {
  it.each(POSITIONS)("issues the position when both comparisons agree on %s", (position) => {
    const result = evaluateFlipTest(position, position);
    expect(result.status).toBe("ISSUED");
    expect(result.position).toBe(position);
    expect(result.reason).toContain(position);
  });

  it.each([
    ["CHEAP", "FAIR"],
    ["CHEAP", "EXPENSIVE"],
    ["FAIR", "EXPENSIVE"],
    ["EXPENSIVE", "CHEAP"],
  ] as [Step5Position, Step5Position][])(
    "is INCONCLUSIVE, never a default, when growth-inclusive=%s disagrees with conservative=%s",
    (growthInclusive, conservative) => {
      const result = evaluateFlipTest(growthInclusive, conservative);
      expect(result.status).toBe("INCONCLUSIVE");
      expect(result.position).toBeNull();
      expect(result.reason).toContain(growthInclusive);
      expect(result.reason).toContain(conservative);
      expect(result.reason).toContain("never falls back to a default");
    }
  );

  it("never substitutes a numeric tolerance — disagreement is exact label inequality only", () => {
    // FAIR vs FAIR agrees; any other pairing disagrees. There is no
    // adjacency/"close enough" rule between CHEAP/FAIR/EXPENSIVE anywhere in
    // this function.
    expect(evaluateFlipTest("FAIR", "FAIR").status).toBe("ISSUED");
    expect(evaluateFlipTest("CHEAP", "FAIR").status).toBe("INCONCLUSIVE");
    expect(evaluateFlipTest("EXPENSIVE", "FAIR").status).toBe("INCONCLUSIVE");
  });
});
