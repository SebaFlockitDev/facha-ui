import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { converter, differenceEuclidean, wcagContrast } from "culori";
import { describe, expect, it } from "vitest";
import { ACCENT_SEEDS, BRIGHT_SOLID, HOVER_DELTA_E, RADIX, SOURCES, STATUS_SEEDS, fluentShadow } from "../src/standards.js";

// The constants of the design-system generator come from published sources (B-025, SPEC §2.h):
// the ones measured from Radix Colors are measured again here from the published scales.

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "radix-colors-3.0.0.json");
const radix = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
  license: string;
  accents: Record<string, Record<"light" | "dark", string[]>>;
  grays: Record<string, Record<"light" | "dark", string[]>>;
};
const oklch = converter("oklch");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const BRIGHT = ["amber", "yellow", "lime", "mint", "sky"];

describe("standards · measured from Radix Colors 3.0.0", () => {
  it("is the published MIT package, 25 accents and 6 grays in light and dark", () => {
    expect(radix.license).toBe("MIT");
    expect(Object.keys(radix.accents)).toHaveLength(25);
    expect(Object.keys(radix.grays)).toHaveLength(6);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`the ${mode} step contrasts, chroma shares and tinted grays match the scales`, () => {
      const steps = [...Array(12).keys()];
      const accents = Object.entries(radix.accents);
      const tinted = Object.entries(radix.grays).filter(([n]) => n !== "gray").map(([, s]) => s[mode]);
      expect(steps.map((i) => r3(median(accents.filter(([n]) => !(i === 8 && BRIGHT.includes(n))).map(([, s]) => wcagContrast(s[mode][i]!, s[mode][0]!)))))).toEqual(RADIX[mode].accentContrast);
      expect(steps.map((i) => r3(median(accents.map(([, s]) => oklch(s[mode][i]!)!.c / oklch(s[mode][8]!)!.c))))).toEqual(RADIX[mode].accentChroma);
      expect(steps.map((i) => r3(median(tinted.map((s) => oklch(s[i]!)!.l))))).toEqual(RADIX[mode].grayL);
      expect(steps.map((i) => r3(median(tinted.map((s) => oklch(s[i]!)!.c ?? 0))))).toEqual(RADIX[mode].grayC);
      expect(steps.map((i) => r3(median(Object.values(radix.grays).map((s) => wcagContrast(s[mode][i]!, s[mode][0]!)))))).toEqual(RADIX[mode].grayContrast);
    });
  }

  it("the hover distance and the bright solids are measured from the scales", () => {
    const dE = differenceEuclidean("oklab");
    for (const mode of ["light", "dark"] as const)
      expect(r3(median(Object.values(radix.accents).map((s) => dE(s[mode][8]!, s[mode][9]!) * 100)))).toBe(HOVER_DELTA_E[mode]);
    const l9 = (n: string) => r3(oklch(radix.accents[n]!.light[8]!)!.l);
    expect(Math.min(...BRIGHT.map(l9))).toBe(BRIGHT_SOLID.brightMinL);
    expect(Math.max(...Object.keys(radix.accents).filter((n) => !BRIGHT.includes(n)).map(l9))).toBe(BRIGHT_SOLID.otherMaxL);
  });

  it("the state and seed colors are step 9 of their Radix scale, the same in light and dark", () => {
    for (const s of [...Object.values(STATUS_SEEDS), ...ACCENT_SEEDS]) {
      expect(radix.accents[s.radix]!.light[8], s.radix).toBe(s.hex);
      expect(radix.accents[s.radix]!.dark[8], s.radix).toBe(s.hex);
    }
  });
});

describe("standards · other published values", () => {
  it("Fluent 2 shadows follow createShadowTokens", () => {
    expect(fluentShadow(2, "light")).toBe("0 0 2px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.14)");
    expect(fluentShadow(8, "light")).toBe("0 0 2px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.14)");
    expect(fluentShadow(16, "dark")).toBe("0 0 2px rgba(0, 0, 0, 0.24), 0 8px 16px rgba(0, 0, 0, 0.28)");
  });

  it("every source names where it comes from", () => {
    for (const [id, text] of Object.entries(SOURCES)) expect(text, id).toMatch(/https:\/\/|mcp\/src\/|skills\//);
  });
});
