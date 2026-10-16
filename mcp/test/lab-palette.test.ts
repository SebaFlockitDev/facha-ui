import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { converter } from "culori";
import { beforeAll, describe, expect, it } from "vitest";
import { RADII, RADIX, STATUS_MIN_DELTA_E as MCP_STATUS, WCAG } from "../src/standards.js";

// The live panel's design controls (B-031): pure logic in a lab template, tested here. Imported at
// run time, as live.test.ts does with live-core.ts: the templates are outside this package's rootDir.

const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills", "variants", "templates", "next-app", "lab-palette.ts");

interface PaletteBase {
  anchor: string;
  themes: { name: string; selector: string }[];
  tokens: { name: string; role?: string; values: Record<string, string> }[];
  references?: { where: string; values: string[] }[];
}
interface DesignChoice {
  id: string;
  name: string;
  hue: number | null;
  brand: number;
  tint: number | null;
  radius: number | null;
  control: number | null;
  contrast: "AA" | "AAA" | null;
  base?: string;
}
type TokenValues = Record<string, Record<string, string>>;
interface Pair {
  theme: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  kind: "text" | "brand" | "border";
}
interface Conflict {
  kind: "status" | "literal" | "contrast";
  text: string;
  fix: string;
}
interface Ok {
  ok: boolean;
  why: string;
}
interface LabPalette {
  RADIX_GRAYS: Record<"light" | "dark", { L: number[]; C: number[] }>;
  RADIUS_STEPS: number[];
  CONTROL_STEPS: number[];
  WCAG_MIN: { AA: number; AAA: number; nonText: number };
  STATUS_MIN_DELTA_E: number;
  PRESETS: (DesignChoice & { note: string })[];
  ORIGINAL: DesignChoice;
  capabilities: (base: PaletteBase) => { tint: Ok; radius: Ok; control: Ok };
  computeDesign: (base: PaletteBase, choice: DesignChoice) => TokenValues;
  describeChoice: (choice: DesignChoice) => string;
  contrastPairs: (base: PaletteBase, values: TokenValues, level?: "AA" | "AAA") => Pair[];
  designConflicts: (base: PaletteBase, choice: DesignChoice | null, safe: string[]) => Conflict[];
}
let CONTROL_STEPS: LabPalette["CONTROL_STEPS"], ORIGINAL: DesignChoice, PRESETS: LabPalette["PRESETS"], RADIUS_STEPS: number[], RADIX_GRAYS: LabPalette["RADIX_GRAYS"];
let STATUS_MIN_DELTA_E: number, WCAG_MIN: LabPalette["WCAG_MIN"];
let capabilities: LabPalette["capabilities"], computeDesign: LabPalette["computeDesign"], contrastPairs: LabPalette["contrastPairs"];
let describeChoice: LabPalette["describeChoice"], designConflicts: LabPalette["designConflicts"];
beforeAll(async () => {
  const lp = (await import(pathToFileURL(TEMPLATE).href)) as LabPalette;
  ({ CONTROL_STEPS, ORIGINAL, PRESETS, RADIUS_STEPS, RADIX_GRAYS, STATUS_MIN_DELTA_E, WCAG_MIN, capabilities, computeDesign, contrastPairs, describeChoice, designConflicts } = lp);
});

const oklch = converter("oklch");
const BASE: PaletteBase = {
  anchor: "--primary",
  themes: [
    { name: "light", selector: ":root" },
    { name: "dark", selector: ".dark" },
  ],
  tokens: [
    { name: "--bg", role: "surface.base", values: { light: "#ffffff", dark: "#111113" } },
    { name: "--panel", role: "surface.raised", values: { light: "#f8f9fb", dark: "#19191b" } },
    { name: "--text", role: "text.primary", values: { light: "#1e1f25", dark: "#eeeef0" } },
    { name: "--text-muted", role: "text.secondary", values: { light: "#6b6f78", dark: "#9a9ca3" } },
    { name: "--border", role: "border.default", values: { light: "#d8d9dc", dark: "#393a3e" } },
    { name: "--border-strong", role: "border.default", values: { light: "#909096", dark: "#62656d" } },
    { name: "--primary", role: "accent.primary", values: { light: "#4f46e5", dark: "#4f46e5" } },
    { name: "--success", role: "status.success", values: { light: "#30a46c", dark: "#30a46c" } },
    { name: "--radius", role: "radius", values: { light: "8px" } },
    { name: "--radius-sm", role: "radius", values: { light: "4px" } },
    { name: "--radius-full", role: "radius", values: { light: "9999px" } },
    { name: "--size-control", role: "generic", values: { light: "40px" } },
  ],
};
const choice = (over: Partial<DesignChoice>): DesignChoice => ({ ...ORIGINAL, ...over });

describe("lab-palette · published values", () => {
  it("are the same as the generator's (mcp/src/standards.ts)", () => {
    expect(RADIX_GRAYS.light.L).toEqual(RADIX.light.grayL);
    expect(RADIX_GRAYS.light.C).toEqual(RADIX.light.grayC);
    expect(RADIX_GRAYS.dark.L).toEqual(RADIX.dark.grayL);
    expect(RADIX_GRAYS.dark.C).toEqual(RADIX.dark.grayC);
    const material = RADII.map(([, v]) => v);
    for (const r of RADIUS_STEPS) expect(material, `radius ${r}`).toContain(r);
    expect(CONTROL_STEPS).toEqual([32, 40, 48]);
    expect([WCAG_MIN.AA, WCAG_MIN.AAA, WCAG_MIN.nonText]).toEqual([WCAG.AA.text, WCAG.AAA.text, WCAG.AA.nonText]);
    expect(STATUS_MIN_DELTA_E).toBe(MCP_STATUS);
  });

  it("presets are Radix accents, named by their scale with no claims about the market (B-036)", () => {
    for (const p of PRESETS) expect(p.note, p.id).toMatch(/^Radix [a-z]+(-9 \(#[0-9a-f]{6}\))?/);
    expect(PRESETS.map((p) => p.note).join(" ")).not.toMatch(/más usado|transmite|asociado|común en/i);
  });
});

describe("lab-palette · controls", () => {
  it("the original choice changes nothing", () => {
    expect(computeDesign(BASE, ORIGINAL)).toEqual({});
    expect(describeChoice(ORIGINAL)).toBe("Original");
  });

  it("tint 0 gives Radix's untinted gray; tint 1 its tinted gray with the brand's hue; the brand stays", () => {
    const pure = computeDesign(BASE, choice({ tint: 0 }));
    for (const name of ["--bg", "--panel", "--text-muted", "--border"]) {
      const v = pure[name]?.light ?? BASE.tokens.find((t) => t.name === name)!.values.light!;
      expect(oklch(v)!.c ?? 0, name).toBeLessThan(0.002);
    }
    // From pure grays, tint 1 adds Radix's tinted-gray chroma with the brand's hue.
    const grays: PaletteBase = {
      ...BASE,
      tokens: BASE.tokens.map((t) =>
        t.name === "--panel" ? { ...t, values: { light: "#f5f5f5", dark: "#1a1a1a" } } : t.name === "--text-muted" ? { ...t, values: { light: "#6e6e6e", dark: "#9b9b9b" } } : t,
      ),
    };
    const tinted = computeDesign(grays, choice({ tint: 1 }));
    expect(oklch(tinted["--text-muted"]!.light!)!.c).toBeGreaterThan(0.005);
    const panel = oklch(tinted["--panel"]!.light!)!;
    expect(panel.c).toBeGreaterThan(0.001);
    expect(panel.c).toBeLessThan(0.02);
    expect(Math.abs(panel.h! - oklch("#4f46e5")!.h!)).toBeLessThan(15);
    expect(tinted["--primary"]).toBeUndefined();
    expect(tinted["--success"]).toBeUndefined();
  });

  it("radius scales every radius token to the new base, and leaves full alone", () => {
    const r = computeDesign(BASE, choice({ radius: 16 }));
    expect(r["--radius"]).toEqual({ light: "16px" });
    expect(r["--radius-sm"]).toEqual({ light: "8px" });
    expect(r["--radius-full"]).toBeUndefined();
  });

  it("control height sets --size-control", () => {
    expect(computeDesign(BASE, choice({ control: 48 }))["--size-control"]).toEqual({ light: "48px" });
  });

  it("contrast AA and AAA bring every text to 4.5:1 and 7:1 on every surface, in both themes", () => {
    for (const level of ["AA", "AAA"] as const) {
      const values = computeDesign(BASE, choice({ contrast: level }));
      const texts = contrastPairs(BASE, values, level).filter((p) => p.kind === "text");
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.filter((p) => p.ratio < WCAG_MIN[level]), level).toEqual([]);
    }
    // AAA had to move the muted text; the brand and the surfaces stay.
    const aaa = computeDesign(BASE, choice({ contrast: "AAA" }));
    expect(aaa["--text-muted"]).toBeDefined();
    expect(aaa["--bg"]).toBeUndefined();
    expect(aaa["--primary"]).toBeUndefined();
  });

  it("a preset moves the brand family's hue and leaves the states", () => {
    const v = computeDesign(BASE, PRESETS.find((p) => p.id === "teal")!);
    expect(Math.abs(oklch(v["--primary"]!.light!)!.h! - 182)).toBeLessThan(6);
    expect(v["--success"]).toBeUndefined();
  });

  it("names the combination for the proposal", () => {
    expect(describeChoice({ ...PRESETS[0]!, radius: 12, contrast: "AAA" })).toBe("Índigo · radio 12px · contraste alto");
    expect(describeChoice(choice({ tint: 0, control: 32 }))).toBe("gris puro · controles 32px");
  });

  it("says which controls the project's tokens cannot take, and why", () => {
    const bare: PaletteBase = { ...BASE, tokens: BASE.tokens.filter((t) => t.role !== "radius" && t.name !== "--size-control") };
    const c = capabilities(bare);
    expect(c.radius.ok).toBe(false);
    expect(c.radius.why).toContain("radio");
    expect(c.control.ok).toBe(false);
    expect(capabilities(BASE).control.ok).toBe(true);
  });
});

describe("lab-palette · what a choice would break", () => {
  it("a brand moved close to a hand-written status color is a conflict, with a way out", () => {
    const base: PaletteBase = { ...BASE, references: [{ where: ".chip-sent", values: ["#3e63dd"] }] };
    const red: PaletteBase = { ...base, tokens: base.tokens.map((t) => (t.name === "--primary" ? { ...t, values: { light: "#e5484d", dark: "#e5484d" } } : t)) };
    const conflicts = designConflicts(red, PRESETS.find((p) => p.id === "indigo")!, []);
    const status = conflicts.find((c) => c.kind === "status");
    expect(status?.text).toContain(".chip-sent");
    expect(status?.fix).toContain("WCAG 1.4.1");
  });

  it("a pair that passes today and would not is listed with its fix; one that already failed is not", () => {
    // An amber brand passes 4.5:1 on white (5.0); moved to teal at the same lightness it does not.
    const amber = (extra: PaletteBase["tokens"] = []): PaletteBase => ({
      anchor: "--primary",
      themes: [{ name: "light", selector: ":root" }],
      tokens: [{ name: "--bg", role: "surface.base", values: { light: "#ffffff" } }, { name: "--primary", role: "accent.primary", values: { light: "#b45309" } }, ...extra],
    });
    const teal = PRESETS.find((p) => p.id === "teal")!;
    expect(contrastPairs(amber(), {})[0]!.ratio).toBeGreaterThanOrEqual(4.5);
    const conflicts = designConflicts(amber(), teal, []);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: "contrast" });
    expect(conflicts[0]!.text).toContain("--primary sobre --bg");
    expect(conflicts[0]!.fix).toContain("tono más oscuro");
    // A text that already failed (3.0:1) is the project's problem, not the choice's: not listed.
    const faint = amber([{ name: "--text-faint", role: "text.tertiary", values: { light: "#949494" } }]);
    expect(contrastPairs(faint, {}).find((p) => p.fg === "--text-faint")!.ratio).toBeLessThan(4.5);
    expect(designConflicts(faint, teal, []).filter((c) => c.text.includes("--text-faint"))).toEqual([]);
    expect(designConflicts(BASE, ORIGINAL, [])).toEqual([]);
  });
});
