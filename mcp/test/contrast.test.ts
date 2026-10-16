import { describe, expect, it } from "vitest";
import { contrast, parseColor, shownRatio } from "../src/color.js";

// B-032: WCAG contrast is decided on the unrounded ratio ("4.499:1 would not meet the 4.5:1
// threshold", Understanding 1.4.3); the number shown is truncated, never rounded up.

describe("contrast · no rounding", () => {
  it("a pair at 4.4989:1 does not reach 4.5:1, and reads 4.49", () => {
    const r = contrast(parseColor("#168484")!, parseColor("#ffffff")!);
    expect(r).toBeGreaterThan(4.49);
    expect(r).toBeLessThan(4.5);
    expect(r >= 4.5).toBe(false);
    expect(shownRatio(r)).toBe(4.49);
  });

  it("shows exact values unchanged and never rounds up", () => {
    expect(shownRatio(21)).toBe(21);
    expect(shownRatio(4.5)).toBe(4.5);
    expect(shownRatio(3.0099)).toBe(3);
    expect(shownRatio(1.1899)).toBe(1.18);
  });
});
