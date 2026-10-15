import { converter, differenceEuclidean, filterDeficiencyDeuter, filterDeficiencyProt, formatHex, parse, toGamut, wcagContrast } from "culori";
import type { Color } from "culori";
import {
  ACCENT_SEEDS, BRIGHT_SOLID, DEFAULT_RADIUS, HOVER_DELTA_E, DENSITY, fluentShadow, LINE_HEIGHT, MIN_TARGET, RADII, RADIX, SHADOWS, SOURCES,
  SPACING, STATUS_MIN_DELTA_E, STATUS_SEEDS, SYSTEM_FONT, TYPE_NAMES, WCAG, type SourceId,
} from "./standards.js";

/**
 * The design-system generator (B-025, SPEC §2.h): from a brand color (or seeds when there is
 * none), a density and an accessibility level, it builds a complete system whose every value comes
 * from a published standard (standards.ts) or from a WCAG threshold. Pure and deterministic: the
 * same input gives the same output, and it reads no file, network or project code.
 *
 * Color method: each step of a 12-step scale (Radix roles) gets the lightness that reaches the
 * contrast Radix measures for that step against the background (Leonardo's approach), with the
 * brand's hue and a share of its chroma; step 9 is the brand itself. Light and dark are solved
 * separately. Text roles are then pushed until they pass WCAG on every surface they sit on, and
 * every pair is proved on the final hex values.
 */

export type Mode = "light" | "dark";
export type Density = keyof typeof DENSITY;
export type Level = "AA" | "AAA";
export type Format = "css" | "tailwind4";
const MODES: Mode[] = ["light", "dark"];
const KINDS = ["success", "warning", "danger", "info"] as const;
type Kind = (typeof KINDS)[number];

const toOklch = converter("oklch");
const gamut = toGamut("rgb", "oklch");
const oklabDistance = differenceEuclidean("oklab");
const deuteranopia = filterDeficiencyDeuter(1);
const protanopia = filterDeficiencyProt(1);

export interface SystemInput {
  brandColor?: string;
  density: Density;
  level: Level;
  format: Format;
  fontFamily?: string;
  radius?: number;
  /** How many seed directions to build when there is no brand color (3 to 5). */
  seeds?: number;
}

export interface Token {
  name: string;
  /** The facha-ui role this name is read as (tokens.ts inferRole). */
  role: string;
  light: string;
  dark: string;
  sources: (SourceId | "brief")[];
  /** Written as var(alias): the same value by design, so facha-ui does not report a near-duplicate. */
  alias?: string;
}

export interface ProofRow {
  mode: Mode;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  pass: boolean;
  rule: SourceId;
}

export interface Direction {
  id: string;
  seed: { hex: string; oklch: string; from: string };
  scales: Record<Mode, Record<"accent" | "neutral" | Kind, string[]>>;
  tokens: Token[];
  proof: ProofRow[];
  adjustments: { token: string; mode: Mode | "both"; from: string; to: string; why: string }[];
  conflicts: { with: string; deltaE: number; solution: string; source: SourceId }[];
  notes: string[];
  css: { light: { selector: string; text: string }; dark: { selector: string; text: string } };
}

const hex = (c: Color): string => formatHex(gamut(c));
const raw = (a: string, b: string): number => wcagContrast(a, b);
const r2 = (n: number): number => Math.round(n * 100) / 100;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;
/** OKLCH with the hue always set (0 for grays). */
type Lch = { mode: "oklch"; l: number; c: number; h: number };
const lch = (h: string): Lch => {
  const c = toOklch(parse(h)!)!;
  return { mode: "oklch", l: c.l, c: c.c ?? 0, h: Number.isFinite(c.h) ? c.h! : 0 };
};
const fmtOklch = (h: string): string => {
  const c = lch(h);
  return `oklch(${r3(c.l)} ${r3(c.c)} ${r3(c.h)})`;
};

/**
 * The color of hue h and chroma c whose contrast against bg reaches target: darker than bg in
 * light mode, lighter in dark mode (the lightest, or darkest, color that still reaches it).
 */
function solve(mode: Mode, h: number, c: number, target: number, bg: string): string {
  const lbg = lch(bg).l;
  const at = (l: number) => hex({ mode: "oklch", l, c, h });
  if (target <= 1) return at(lbg);
  let lo = mode === "light" ? 0 : lbg;
  let hi = mode === "light" ? lbg : 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ok = raw(at(mid), bg) >= target;
    if (mode === "light") ok ? (lo = mid) : (hi = mid);
    else ok ? (hi = mid) : (lo = mid);
  }
  return at(mode === "light" ? lo : hi);
}

function neutralScale(mode: Mode, h: number): string[] {
  const m = RADIX[mode];
  const bg = hex({ mode: "oklch", l: m.grayL[0]!, c: m.grayC[0]!, h });
  return m.grayContrast.map((t, i) => (i === 0 ? bg : solve(mode, h, m.grayC[i]!, t, bg)));
}

/** A 12-step scale whose step 9 is the solid color given; the hover step keeps on-text legible. */
function accentScale(mode: Mode, solid: string, bg: string, onText: string, textMin: number): string[] {
  const m = RADIX[mode];
  const s = lch(solid);
  const solidRatio = raw(solid, bg);
  // Step 11 (accent text) is never lighter than the brand in light mode, nor darker in dark mode:
  // in Radix it always contrasts at least as much as step 9.
  const target = (t: number, i: number) => (i === 10 ? Math.max(t, solidRatio) : t);
  const steps = m.accentContrast.map((t, i) => (i === 8 ? solid : i === 9 ? "" : solve(mode, s.h, s.c * m.accentChroma[i]!, target(t, i), bg)));
  // Hover: as far from the solid as Radix moves it (HOVER_DELTA_E), away from the background
  // (darker in light, lighter in dark); if the on-text loses contrast that way, the other way;
  // as a last resort it stays the solid (and a note says so).
  const away = mode === "light" ? -1 : 1;
  const hover = (dir: number) => {
    for (let step = 1; step <= 300; step++) {
      const c = hex({ mode: "oklch", l: s.l + (dir * step) / 1000, c: s.c * m.accentChroma[9]!, h: s.h });
      if (oklabDistance(parse(c)!, parse(solid)!) * 100 >= HOVER_DELTA_E[mode]) return c;
    }
    return solid;
  };
  steps[9] = [hover(away), hover(-away)].find((c) => c !== solid && raw(onText, c) >= textMin) ?? solid;
  return steps;
}

/** Radix's text on a solid: dark on a bright one, white on any other. */
function textOn(solid: string, darkText: string): string {
  return lch(solid).l > BRIGHT_SOLID.threshold ? darkText : "#ffffff";
}

/**
 * The solid closest in lightness to the seed on which its text (textOn) reaches min: darker for
 * white text, lighter for dark text.
 */
function legibleSolid(seed: string, darkText: string, min: number): string {
  const text = textOn(seed, darkText);
  if (raw(text, seed) >= min) return seed;
  const s = lch(seed);
  const dir = text === "#ffffff" ? -1 : 1;
  for (let step = 1; step <= 100; step++) {
    const c = hex({ mode: "oklch", l: s.l + (dir * step) / 200, c: s.c, h: s.h });
    if (raw(text, c) >= min) return c;
  }
  return text === "#ffffff" ? "#000000" : "#ffffff";
}

/** Smallest ΔE (OKLab×100) between two colors, also under deuteranopia and protanopia. */
function confusable(a: string, b: string): number {
  const ca = parse(a)!;
  const cb = parse(b)!;
  return r2(Math.min(oklabDistance(ca, cb), oklabDistance(deuteranopia(ca), deuteranopia(cb)), oklabDistance(protanopia(ca), protanopia(cb))) * 100);
}

function buildDirection(id: string, seed: string, from: string, input: SystemInput): Direction {
  const min = WCAG[input.level];
  const textRule: SourceId = input.level === "AAA" ? "wcag146" : "wcag143";
  const adjustments: Direction["adjustments"] = [];
  const notes: string[] = [];
  const h = lch(seed).h;

  const neutral = { light: neutralScale("light", h), dark: neutralScale("dark", h) };
  const darkText = neutral.light[11]!;

  // Step 9 is the brand in both modes (as in every Radix scale), once text on it is legible.
  const solids = { accent: legibleSolid(seed, darkText, min.text) } as Record<"accent" | Kind, string>;
  const onText = {} as Record<"accent" | Kind, string>;
  const why: Partial<Record<"accent" | Kind, string[]>> = {};
  const textReason = `text on it did not reach ${min.text}:1 (${SOURCES[textRule].split(" · ")[0]}); its lightness moved the least that does`;
  if (solids.accent !== seed) why.accent = [textReason];
  for (const k of KINDS) {
    solids[k] = legibleSolid(STATUS_SEEDS[k].hex, darkText, min.text);
    if (solids[k] !== STATUS_SEEDS[k].hex) why[k] = [textReason];
  }

  // A blue or violet brand and a blue info state cannot be told apart (under deuteranopia almost
  // every such pair is under ΔE 10): info, the least critical state, takes the brand's family.
  const infoDelta = confusable(solids.accent, solids.info);
  const infoFollowsBrand = infoDelta < STATUS_MIN_DELTA_E;
  if (infoFollowsBrand) {
    solids.info = solids.accent;
    delete why.info;
    notes.push(`The info state uses the brand's colors: a separate blue would not be told apart from it (ΔE ${infoDelta} under color-vision deficiency). Like every state, it always carries its text (WCAG 1.4.1).`);
  }

  // States must be told apart under color-vision deficiency too (facha-ui's status-confusable):
  // what survives it is lightness. A state too close to an earlier one moves in lightness, up or
  // down, the least that separates them while its text (white or dark) stays legible. Danger never
  // moves: red is the critical one.
  const legible = (c: string) => [textOn(c, darkText), textOn(c, darkText) === darkText ? "#ffffff" : darkText].find((t) => raw(t, c) >= min.text);
  const ORDER: Kind[] = ["danger", "warning", "success", "info"];
  for (let i = 1; i < ORDER.length; i++) {
    const k = ORDER[i]!;
    if (k === "info" && infoFollowsBrand) continue;
    const others = ORDER.slice(0, i).map((o) => solids[o]);
    const apart = (c: string) => others.every((o) => confusable(c, o) >= STATUS_MIN_DELTA_E + 1);
    if (apart(solids[k])) continue;
    const s = lch(STATUS_SEEDS[k].hex);
    search: for (let step = 1; step <= 60; step++)
      for (const dir of [1, -1]) {
        const c = hex({ mode: "oklch", l: s.l + (dir * step) / 100, c: s.c, h: s.h });
        if (legible(c) && apart(c)) {
          solids[k] = c;
          why[k] = [`moved in lightness so it is told apart from ${ORDER.slice(0, i).join(" and ")} also under deuteranopia and protanopia (ΔE ≥ ${STATUS_MIN_DELTA_E}, WCAG 1.4.1), with legible text on it`];
          break search;
        }
      }
  }
  for (const k of ["accent", ...KINDS] as const) onText[k] = legible(solids[k]) ?? textOn(solids[k], darkText);
  for (const k of ["accent", ...KINDS] as const) {
    const from = k === "accent" ? seed : STATUS_SEEDS[k].hex;
    if (why[k] && solids[k] !== from)
      adjustments.push({ token: k === "accent" ? "--color-primary" : `--color-${k}`, mode: "both", from, to: solids[k], why: why[k]!.join("; ") });
  }

  const scales = {} as Direction["scales"];
  for (const mode of MODES) {
    const bg = neutral[mode][0]!;
    scales[mode] = {
      neutral: neutral[mode],
      accent: accentScale(mode, solids.accent, bg, onText.accent, min.text),
      ...(Object.fromEntries(KINDS.map((k) => [k, accentScale(mode, solids[k], bg, onText[k], min.text)])) as Record<Kind, string[]>),
    };
  }

  // Tokens, by role. Text roles are pushed until they pass on every surface they sit on.
  const tokens: Token[] = [];
  const proof: ProofRow[] = [];
  const value = (name: string, mode: Mode) => tokens.find((t) => t.name === name)![mode];
  const add = (name: string, role: string, sources: Token["sources"], pick: (mode: Mode) => string) =>
    tokens.push({ name, role, light: pick("light"), dark: pick("dark"), sources });
  const ensure = (name: string, on: string[], threshold: number, rule: SourceId) => {
    const t = tokens.find((x) => x.name === name)!;
    for (const mode of MODES) {
      const before = t[mode];
      const c = lch(before);
      let current = before;
      for (let pass = 0; pass < 3; pass++) {
        const worst = on.map((s) => value(s, mode)).sort((a, b) => raw(current, a) - raw(current, b))[0]!;
        if (raw(current, worst) >= threshold) break;
        current = solve(mode, c.h, c.c, threshold, worst);
      }
      if (current !== before) {
        t[mode] = current;
        if (!t.sources.includes(rule)) t.sources.push(rule);
        adjustments.push({ token: name, mode, from: before, to: current, why: `${threshold}:1 on ${on.join(", ")} (${SOURCES[rule].split(" · ")[0]})` });
      }
    }
  };
  const prove = (fg: string, on: string[], threshold: number, rule: SourceId) => {
    for (const mode of MODES)
      for (const bg of on) {
        const ratio = raw(value(fg, mode), value(bg, mode));
        proof.push({ mode, fg, bg, ratio: r2(ratio), min: threshold, pass: ratio >= threshold, rule });
      }
  };

  const n = (i: number) => (mode: Mode) => scales[mode].neutral[i]!;
  const a = (i: number) => (mode: Mode) => scales[mode].accent[i]!;
  add("--color-background", "surface.base", ["radix"], n(0));
  add("--color-panel", "surface.raised", ["radix"], n(1));
  add("--color-muted", "generic", ["radix"], n(2));
  add("--color-foreground", "text.primary", ["radix"], n(11));
  add("--color-muted-foreground", "text.secondary", ["radix"], n(10));
  add("--color-border", "border.default", ["radix"], n(5));
  add("--color-border-strong", "border.default", ["leonardo", "wcag1411"], (mode) => solveOn(mode, lch(scales[mode].neutral[7]!), min.nonText, [n(0)(mode), n(1)(mode)]));
  add("--color-ring", "generic", ["leonardo", "wcag1411"], (mode) => solveOn(mode, lch(scales[mode].accent[7]!), min.nonText, [n(0)(mode), n(1)(mode)]));
  add("--color-primary", "accent.primary", ["radix"], a(8));
  add("--color-primary-hover", "accent", ["radix"], a(9));
  add("--color-primary-subtle", "accent", ["radix"], a(2));
  add("--color-primary-strong", "accent", ["radix"], a(10));
  add("--color-on-primary", "on-accent", [textRule], () => onText.accent);
  for (const k of KINDS) {
    const s = (i: number) => (mode: Mode) => scales[mode][k][i]!;
    add(`--color-${k}`, `status.${k}`, ["radix"], s(8));
    add(`--color-${k}-text`, `status.${k}`, ["radix"], s(10));
    add(`--color-${k}-bg`, `status.${k}`, ["radix"], s(2));
    add(`--color-${k}-border`, `status.${k}`, ["radix"], s(6));
    add(`--color-on-${k}`, "on-accent", [textRule], () => onText[k]);
  }

  const surfaces = ["--color-background", "--color-panel", "--color-muted"];
  ensure("--color-foreground", surfaces, min.text, textRule);
  ensure("--color-muted-foreground", surfaces, min.text, textRule);
  ensure("--color-primary-strong", ["--color-background", "--color-panel", "--color-primary-subtle"], min.text, textRule);
  for (const k of KINDS) ensure(`--color-${k}-text`, ["--color-background", "--color-panel", `--color-${k}-bg`], min.text, textRule);

  if (infoFollowsBrand)
    for (const [info, brand] of [["--color-info", "--color-primary"], ["--color-info-text", "--color-primary-strong"], ["--color-info-bg", "--color-primary-subtle"], ["--color-on-info", "--color-on-primary"]] as const) {
      const t = tokens.find((x) => x.name === info)!;
      Object.assign(t, { light: value(brand, "light"), dark: value(brand, "dark"), alias: brand });
    }

  prove("--color-foreground", surfaces, min.text, textRule);
  prove("--color-muted-foreground", surfaces, min.text, textRule);
  prove("--color-primary-strong", ["--color-background", "--color-panel", "--color-primary-subtle"], min.text, textRule);
  prove("--color-on-primary", ["--color-primary", "--color-primary-hover"], min.text, textRule);
  for (const k of KINDS) {
    prove(`--color-${k}-text`, ["--color-background", "--color-panel", `--color-${k}-bg`], min.text, textRule);
    prove(`--color-on-${k}`, [`--color-${k}`], min.text, textRule);
  }
  prove("--color-border-strong", ["--color-background", "--color-panel"], min.nonText, "wcag1411");
  prove("--color-ring", ["--color-background", "--color-panel"], min.nonText, "wcag1411");

  for (const mode of MODES) {
    const r = raw(value("--color-primary", mode), value("--color-background", mode));
    if (r < min.nonText)
      notes.push(`${mode}: the brand color is ${Math.floor(r * 100) / 100}:1 on the background, under 3:1. Buttons with a text label are fine (the label identifies them); an icon-only control needs --color-border-strong around it (WCAG 1.4.11).`);
  }
  for (const mode of MODES)
    if (value("--color-primary-hover", mode) === value("--color-primary", mode))
      notes.push(`${mode}: the hover step equals the brand color: no lighter or darker step kept the text on it legible.`);

  const conflicts: Direction["conflicts"] = [];
  for (const k of KINDS) {
    if (k === "info" && infoFollowsBrand) continue;
    // The brand as given and as adjusted, against the state as adjusted and its family (its Radix
    // seed): a green brand reads as success even when one of them moved in lightness.
    const d = Math.min(...[solids.accent, seed].flatMap((b) => [confusable(b, solids[k]), confusable(b, STATUS_SEEDS[k].hex)]));
    if (d < STATUS_MIN_DELTA_E)
      conflicts.push({
        with: `status.${k}`,
        deltaE: d,
        solution: `The brand and the ${k} state look alike (ΔE ${d}). Always show the ${k} state with its text label and an icon, never by color alone; or pick a brand seed further from it.`,
        source: "wcag141",
      });
  }

  return { id, seed: { hex: seed, oklch: fmtOklch(seed), from }, scales, tokens, proof, adjustments, conflicts, notes, css: { light: { selector: "", text: "" }, dark: { selector: ".dark", text: "" } } };
}

/** The color with c's hue and chroma that reaches min on every background given. */
function solveOn(mode: Mode, c: Lch, minRatio: number, on: string[]): string {
  let current = hex(c);
  for (let pass = 0; pass < 3; pass++) {
    const worst = [...on].sort((x, y) => raw(current, x) - raw(current, y))[0]!;
    if (raw(current, worst) >= minRatio) return current;
    current = solve(mode, c.h, c.c, minRatio, worst);
  }
  return current;
}

/** Seeds when there is no brand color: Radix accents no state is confused with, spread by hue. */
export function seedColors(count: number): { hex: string; from: string }[] {
  const out: { hex: string; from: string; h: number }[] = [];
  for (const s of ACCENT_SEEDS) {
    // Info adapts to the brand (buildDirection), so only the other states rule a seed out.
    if ((["success", "warning", "danger"] as const).some((k) => confusable(s.hex, STATUS_SEEDS[k].hex) < STATUS_MIN_DELTA_E)) continue;
    const h = lch(s.hex).h;
    if (out.some((o) => Math.min(Math.abs(o.h - h), 360 - Math.abs(o.h - h)) < 45)) continue;
    out.push({ hex: s.hex, from: `Radix ${s.radix}-9`, h });
    if (out.length === count) break;
  }
  return out.map(({ hex, from }) => ({ hex, from }));
}

export function typography(input: SystemInput) {
  const d = DENSITY[input.density];
  return {
    family: input.fontFamily ?? SYSTEM_FONT,
    familySource: (input.fontFamily ? "brief" : "systemFont") as SourceId | "brief",
    base: d.base,
    scale: TYPE_NAMES.map((name, i) => ({ name, px: d.typeScale[i]! })),
    scaleSource: d.typeSource,
    lineHeight: { body: LINE_HEIGHT.body, heading: LINE_HEIGHT.heading, sources: ["wcag148", "material3Heading"] as SourceId[] },
    weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  };
}

function sharedTokens(input: SystemInput): Token[] {
  const t = typography(input);
  const same = (name: string, role: string, v: string, sources: Token["sources"]): Token => ({ name, role, light: v, dark: v, sources });
  const radius = input.radius ?? DEFAULT_RADIUS;
  return [
    same("--font-sans", "font", t.family, input.fontFamily ? ["brief"] : ["systemFont"]),
    ...t.scale.map((s) => same(`--text-${s.name}`, "font-size", `${s.px}px`, [t.scaleSource])),
    same("--leading-normal", "generic", String(LINE_HEIGHT.body), ["wcag148"]),
    same("--leading-tight", "generic", String(LINE_HEIGHT.heading), ["material3Heading"]),
    ...SPACING.map((px, i) => same(`--space-${i + 1}`, "spacing", `${px}px`, ["carbonSpacing"])),
    same("--size-control", "generic", `${DENSITY[input.density].control}px`, ["carbonSize", "wcag258"]),
    same("--radius", "radius", `${radius}px`, ["material3Shape"]),
    ...RADII.filter(([name]) => name !== "none").map(([name, px]) => same(`--radius-${name}`, "radius", `${px}px`, ["material3Shape"])),
    ...SHADOWS.levels.map(([name, depth]) => ({ name: `--shadow-${name}`, role: "shadow", light: fluentShadow(depth, "light"), dark: fluentShadow(depth, "dark"), sources: ["fluentShadow"] as SourceId[] })),
  ];
}

function cssBlocks(id: string, tokens: Token[], format: Format) {
  const light = format === "tailwind4" ? "@theme" : ":root";
  const lines = (pick: (t: Token) => string | null) =>
    tokens.map((t) => [t.name, pick(t)] as const).filter(([, v]) => v !== null).map(([n, v]) => `  ${n}: ${v};`).join("\n");
  return {
    light: { selector: light, text: `/* facha-ui system · ${id} */\n${light} {\n${lines((t) => (t.alias ? `var(${t.alias})` : t.light))}\n}` },
    dark: { selector: ".dark", text: `/* facha-ui system · ${id} · dark */\n.dark {\n${lines((t) => (t.alias ? null : t.name.startsWith("--color-") || t.dark !== t.light ? t.dark : null))}\n}` },
  };
}

export function proposeSystem(input: SystemInput) {
  const seeds = input.brandColor
    ? [{ hex: formatHex(parse(input.brandColor)!), from: "brand" }]
    : seedColors(Math.min(5, Math.max(3, input.seeds ?? 3)));
  const shared = sharedTokens(input);
  const directions = seeds.map((s, i) => {
    const d = buildDirection(input.brandColor ? "brand" : `seed-${i + 1}`, s.hex, s.from, input);
    d.tokens.push(...shared);
    d.css = cssBlocks(d.id, d.tokens, input.format);
    return d;
  });
  const used = new Set<string>(["radix", "leonardo", "wcag1411", "wcag141", "statusDeltaE", "tailwindNames", input.level === "AAA" ? "wcag146" : "wcag143"]);
  for (const t of shared) for (const s of t.sources) if (s !== "brief") used.add(s);
  return {
    typography: typography(input),
    spacing: { scale: SPACING, control: DENSITY[input.density].control, minTarget: MIN_TARGET, sources: ["carbonSpacing", "carbonSize", "wcag258"] },
    radius: { default: input.radius ?? DEFAULT_RADIUS, scale: Object.fromEntries(RADII), source: "material3Shape" },
    directions,
    sources: Object.fromEntries([...used].sort().map((k) => [k, SOURCES[k as SourceId]])),
  };
}
