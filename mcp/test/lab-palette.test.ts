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
  tokens: { name: string; role?: string; format?: string; values: Record<string, string> }[];
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
  seed?: string;
}
type TokenValues = Record<string, Record<string, string>>;
interface Pair {
  theme: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  kind: "text" | "brand" | "border" | "onBrand";
}
interface Conflict {
  kind: "status" | "literal" | "contrast";
  text: string;
  fix: string;
}
interface Ok {
  ok: boolean;
  why: string;
  now?: number | null;
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
  customChoice: (base: PaletteBase, hex: string, from?: DesignChoice) => DesignChoice | null;
  paletteCss: (base: PaletteBase, values: TokenValues) => string;
}
let CONTROL_STEPS: LabPalette["CONTROL_STEPS"], ORIGINAL: DesignChoice, PRESETS: LabPalette["PRESETS"], RADIUS_STEPS: number[], RADIX_GRAYS: LabPalette["RADIX_GRAYS"];
let STATUS_MIN_DELTA_E: number, WCAG_MIN: LabPalette["WCAG_MIN"];
let capabilities: LabPalette["capabilities"], computeDesign: LabPalette["computeDesign"], contrastPairs: LabPalette["contrastPairs"];
let describeChoice: LabPalette["describeChoice"], designConflicts: LabPalette["designConflicts"], customChoice: LabPalette["customChoice"], paletteCss: LabPalette["paletteCss"];
beforeAll(async () => {
  const lp = (await import(pathToFileURL(TEMPLATE).href)) as LabPalette;
  ({ CONTROL_STEPS, ORIGINAL, PRESETS, RADIUS_STEPS, RADIX_GRAYS, STATUS_MIN_DELTA_E, WCAG_MIN, capabilities, computeDesign, contrastPairs, describeChoice, designConflicts, customChoice, paletteCss } = lp);
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

  it("the preview writes a changed token in every theme, so a light-only change never leaks into dark", () => {
    // Found in the browser: :root { --text: <light> !important } beat the project's .dark { --text }.
    const css = paletteCss(BASE, { "--text": { light: "#101820" } });
    expect(css.split("\n")).toEqual([":root { --text: #101820 !important; }", ".dark { --text: #eeeef0 !important; }"]);
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
    expect(capabilities(BASE).control).toMatchObject({ ok: true, now: 40 });
    expect(capabilities(BASE).radius).toMatchObject({ ok: true, now: 8 });
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
    // 4.49 reads 4.4, never "4.5:1 (mínimo 4.5:1)".
    expect(conflicts[0]!.text).toContain("--primary sobre --bg baja a 4.4:1");
    expect(conflicts[0]!.fix).toContain("tono más oscuro");
    // A text that already failed (3.0:1) is the project's problem, not the choice's: not listed.
    const faint = amber([{ name: "--text-faint", role: "text.tertiary", values: { light: "#949494" } }]);
    expect(contrastPairs(faint, {}).find((p) => p.fg === "--text-faint")!.ratio).toBeLessThan(4.5);
    expect(designConflicts(faint, teal, []).filter((c) => c.text.includes("--text-faint"))).toEqual([]);
    expect(designConflicts(BASE, ORIGINAL, [])).toEqual([]);
  });

  it("checks the text on the brand (buttons) and groups a token that fails on several surfaces into one line", () => {
    const withOn: PaletteBase = { ...BASE, tokens: [...BASE.tokens, { name: "--on-primary", role: "on-accent", values: { light: "#ffffff", dark: "#ffffff" } }] };
    expect(contrastPairs(withOn, {}).filter((p) => p.kind === "onBrand").map((p) => [p.theme, p.bg])).toEqual([
      ["light", "--primary"],
      ["dark", "--primary"],
    ]);
    // White text on a light cyan brand: the buttons stop passing 4.5:1.
    const cyan = customChoice(withOn, "#22d3ee")!;
    const conflicts = designConflicts(withOn, cyan, []);
    const onBrand = conflicts.find((c) => c.text.includes("--on-primary sobre --primary"));
    expect(onBrand?.fix).toContain("WCAG 1.4.3");
    // The brand as text fails on the three surfaces of light: one line, with the worst one.
    const brandLight = conflicts.filter((c) => c.text.startsWith("En light, --primary sobre"));
    expect(brandLight).toHaveLength(1);
    expect(brandLight[0]!.text).toContain("también sobre 1 superficie más");
  });
});

describe("lab-palette · oklch() and HSL, the formats of shadcn/ui (B-038)", () => {
  const themes = [
    { name: "light", selector: ":root" },
    { name: "dark", selector: ".dark" },
  ];
  const tw4: PaletteBase = {
    anchor: "--primary",
    themes,
    tokens: [
      { name: "--background", role: "surface.base", values: { light: "oklch(1 0 0)", dark: "oklch(0.145 0 0)" } },
      { name: "--foreground", role: "text.primary", values: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" } },
      { name: "--primary", role: "accent.primary", values: { light: "oklch(0.205 0 0)", dark: "oklch(0.922 0 0)" } },
      { name: "--primary-foreground", role: "on-accent", values: { light: "oklch(0.985 0 0)", dark: "oklch(0.205 0 0)" } },
    ],
  };

  it("reads oklch() and writes the new values in oklch(), leaving the rest as written", () => {
    const v = computeDesign(tw4, choice({ tint: 1, hue: 267 }));
    for (const perTheme of Object.values(v)) for (const value of Object.values(perTheme)) expect(value).toMatch(/^oklch\(/);
    expect(contrastPairs(tw4, {}).find((p) => p.fg === "--foreground")!.ratio).toBeGreaterThan(15);
  });

  it("a gray brand (the shadcn default) takes the preset's own color in both themes, and its text is measured", () => {
    const indigo = PRESETS.find((p) => p.id === "indigo")!;
    const v = computeDesign(tw4, indigo);
    for (const theme of ["light", "dark"]) {
      const c = oklch(v["--primary"]![theme]!)!;
      expect(c.c, theme).toBeGreaterThan(0.1);
      expect(Math.abs(c.h! - oklch("#3e63dd")!.h!), theme).toBeLessThan(3);
    }
    const onBrand = contrastPairs(tw4, v).filter((p) => p.kind === "onBrand");
    expect(onBrand.map((p) => p.theme)).toEqual(["light", "dark"]);
    // Dark: the brand was near white with near-black text on it; on indigo that text no longer reads.
    const dark = designConflicts(tw4, indigo, []).find((c) => c.text.startsWith("En dark, --primary-foreground sobre --primary"));
    // …and the way out is white text: on indigo-9 white reaches 5.2:1 and black only 4.0:1.
    expect(dark?.fix).toContain("un texto claro (blanco)");
    // The brand as text on a dark surface needs a lighter tone, not a darker one.
    const brandDark = designConflicts(tw4, indigo, []).find((c) => c.text.startsWith("En dark, --primary sobre --background"));
    expect(brandDark?.fix).toContain("un tono más claro de la marca");
    // On a light brand (cyan-9, the custom color of the earlier test) the way out is dark text.
    const cyanOn: PaletteBase = { ...BASE, tokens: [...BASE.tokens, { name: "--on-primary", role: "on-accent", values: { light: "#ffffff", dark: "#ffffff" } }] };
    const light = designConflicts(cyanOn, customChoice(cyanOn, "#22d3ee")!, []).find((c) => c.text.includes("--on-primary sobre --primary"));
    expect(light?.fix).toContain("un texto oscuro");
    // Graphite keeps the brand gray: it is "the brand almost without color".
    expect(computeDesign(tw4, PRESETS.find((p) => p.id === "graphite")!)["--primary"]).toBeUndefined();
  });

  it("reads the bare HSL channels of shadcn with Tailwind 3 and writes them back as channels", () => {
    const tw3: PaletteBase = {
      anchor: "--primary",
      themes,
      tokens: [
        { name: "--background", role: "surface.base", format: "hsl-channels", values: { light: "0 0% 100%", dark: "222.2 84% 4.9%" } },
        { name: "--foreground", role: "text.primary", format: "hsl-channels", values: { light: "222.2 84% 4.9%", dark: "210 40% 98%" } },
        { name: "--primary", role: "accent.primary", format: "hsl-channels", values: { light: "221.2 83.2% 53.3%", dark: "217.2 91.2% 59.8%" } },
      ],
    };
    const v = computeDesign(tw3, PRESETS.find((p) => p.id === "teal")!);
    expect(v["--primary"]!.light).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/);
    expect(Math.abs(oklch(`hsl(${v["--primary"]!.light})`)!.h! - 182)).toBeLessThan(6);
    expect(paletteCss(tw3, v)).toContain("--primary: " + v["--primary"]!.light + " !important;");
    expect(contrastPairs(tw3, {}).find((p) => p.fg === "--foreground" && p.theme === "light")!.ratio).toBeGreaterThan(15);
  });
});
