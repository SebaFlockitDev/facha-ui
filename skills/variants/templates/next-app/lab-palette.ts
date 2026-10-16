// facha-ui lab scaffold · removed by /facha-ui:apply when no runs remain

/**
 * The live panel's design preview (B-031, SPEC §2.b): from the project's tokens (the base that
 * scripts/palette-base.mjs reads), a choice of hue, neutral tint, radius, control height and
 * contrast gives new token values, previewed in this browser only: no file changes until the
 * developer approves /facha-ui:init palette. Pure (no DOM, no fetch), so it is tested
 * (mcp/test/lab-palette.test.ts), and its constants are checked against mcp/src/standards.ts.
 */

export interface PaletteBase {
  anchor: string;
  themes: { name: string; selector: string }[];
  /** `format: "hsl-channels"`: shadcn/ui's bare HSL channels (`222.2 47.4% 11.2%`), as get_design_system reports them. */
  tokens: { name: string; role?: string; format?: string; values: Record<string, string> }[];
  /** Hand-written colors of the project (design-system gaps), to warn about conflicts. */
  references?: { where: string; values: string[] }[];
}

/** What to change. A null field keeps the project's value. */
export interface DesignChoice {
  id: string;
  name: string;
  /** Target hue of the brand family (OKLCH degrees); null keeps the colors. */
  hue: number | null;
  /** How much chroma the brand family keeps. */
  brand: number;
  /** Neutrals: 0 is Radix's untinted gray, 1 its tinted grays (with the brand's hue). */
  tint: number | null;
  /** Base radius in px, a step of Material 3's corner scale. */
  radius: number | null;
  /** Control and row height in px, a Carbon size. */
  control: number | null;
  /** Text pushed to WCAG AA (4.5:1) or AAA (7:1) on every surface. */
  contrast: "AA" | "AAA" | null;
  /** The developer's own color, for a custom palette. */
  base?: string;
  /** The preset's own color (Radix step 9): it paints a brand that has no color (B-038). */
  seed?: string;
}

export type TokenValues = Record<string, Record<string, string>>;

// ---- Published values (copies of mcp/src/standards.ts, checked by a test) ----------------------

/** Radix Colors 3.0.0 tinted grays: median OKLCH lightness and chroma of each step. */
export const RADIX_GRAYS = {
  light: {
    L: [0.992, 0.983, 0.956, 0.932, 0.91, 0.886, 0.851, 0.792, 0.641, 0.607, 0.501, 0.242],
    C: [0.002, 0.003, 0.003, 0.003, 0.005, 0.005, 0.006, 0.008, 0.012, 0.012, 0.011, 0.011],
  },
  dark: {
    L: [0.18, 0.213, 0.252, 0.283, 0.312, 0.348, 0.4, 0.489, 0.535, 0.582, 0.767, 0.949],
    C: [0.004, 0.004, 0.004, 0.006, 0.006, 0.007, 0.009, 0.013, 0.017, 0.015, 0.01, 0.003],
  },
};
/** Material 3 corner scale (px): the radius steps the panel offers. */
export const RADIUS_STEPS = [0, 4, 8, 12, 16];
/** Carbon component sizes sm, md, lg (px); all over WCAG 2.5.8's 24px. */
export const CONTROL_STEPS = [32, 40, 48];
/** WCAG 2.2: text 4.5:1 (1.4.3) and 7:1 (1.4.6); borders of controls 3:1 (1.4.11). */
export const WCAG_MIN = { AA: 4.5, AAA: 7, nonText: 3 };
/** facha-ui's status-confusable distance (ΔE OKLab×100). */
export const STATUS_MIN_DELTA_E = 10;

/**
 * Presets: Radix accent scales (step 9's hue), named by their scale and nothing else: whether one
 * suits the product is the developer's call. Conflicts with the states are measured live.
 */
export const PRESETS: (DesignChoice & { note: string })[] = [
  { id: "indigo", name: "Índigo", hue: 267, brand: 1, tint: null, radius: null, control: null, contrast: null, seed: "#3e63dd", note: "Radix indigo-9 (#3e63dd)" },
  { id: "blue", name: "Azul", hue: 251.8, brand: 1, tint: null, radius: null, control: null, contrast: null, seed: "#0090ff", note: "Radix blue-9 (#0090ff)" },
  { id: "cyan", name: "Cyan", hue: 221.7, brand: 1, tint: null, radius: null, control: null, contrast: null, seed: "#00a2c7", note: "Radix cyan-9 (#00a2c7)" },
  { id: "teal", name: "Teal", hue: 182, brand: 1, tint: null, radius: null, control: null, contrast: null, seed: "#12a594", note: "Radix teal-9 (#12a594)" },
  { id: "plum", name: "Ciruela", hue: 322.1, brand: 1, tint: null, radius: null, control: null, contrast: null, seed: "#ab4aba", note: "Radix plum-9 (#ab4aba)" },
  { id: "violet", name: "Violeta", hue: 288, brand: 1, tint: null, radius: null, control: null, contrast: null, seed: "#6e56cf", note: "Radix violet-9 (#6e56cf)" },
  { id: "graphite", name: "Grafito", hue: 267, brand: 0.12, tint: 0, radius: null, control: null, contrast: null, note: "Radix gray: la marca casi sin color" },
];

/** A choice that changes nothing, to start from when only a control moves. */
export const ORIGINAL: DesignChoice = { id: "original", name: "Original", hue: null, brand: 1, tint: null, radius: null, control: null, contrast: null };

// ---- Color math (OKLCH) ---------------------------------------------------------------------

type Rgb = [number, number, number];
interface Parsed {
  rgb: Rgb;
  alpha: number;
  /** How it is written, so a new value keeps the project's format (B-038). */
  kind: "hex" | "hex8" | "rgb" | "oklch" | "hsl";
}
interface Lch {
  L: number;
  C: number;
  h: number;
}

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)|oklch\([^)]*\)|hsla?\([^)]*\)/g;

/** The numbers inside a color function, and its alpha (after "/" or as a 4th value). */
function argsOf(text: string): { nums: string[]; alpha: number } {
  const nums = text.slice(text.indexOf("(") + 1, -1).split(/[\s,/]+/).filter(Boolean);
  const a = nums[3];
  const alpha = a === undefined ? 1 : a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
  return { nums, alpha: Number.isNaN(alpha) ? 1 : alpha };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function rgbToHsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function parseColor(text: string): Parsed | null {
  if (text.startsWith("oklch(")) {
    const { nums, alpha } = argsOf(text);
    if (nums.length < 3) return null;
    const L = nums[0]!.endsWith("%") ? parseFloat(nums[0]!) / 100 : parseFloat(nums[0]!);
    const C = nums[1]!.endsWith("%") ? (parseFloat(nums[1]!) / 100) * 0.4 : parseFloat(nums[1]!);
    const h = nums[2] === "none" ? 0 : parseFloat(nums[2]!);
    if ([L, C, h].some(Number.isNaN)) return null;
    return { rgb: fromLch({ L, C, h }), alpha, kind: "oklch" };
  }
  if (text.startsWith("hsl")) {
    const { nums, alpha } = argsOf(text);
    if (nums.length < 3) return null;
    const h = parseFloat(nums[0]!);
    const s = parseFloat(nums[1]!) / 100;
    const l = parseFloat(nums[2]!) / 100;
    if ([h, s, l].some(Number.isNaN)) return null;
    return { rgb: hslToRgb(((h % 360) + 360) % 360, s, l), alpha, kind: "hsl" };
  }
  if (text.startsWith("#")) {
    let hex = text.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return { rgb: [n(0), n(2), n(4)], alpha: hex.length === 8 ? n(6) : 1, kind: hex.length === 8 ? "hex8" : "hex" };
  }
  const nums = text.slice(text.indexOf("(") + 1, -1).split(/[\s,/]+/).filter(Boolean);
  if (nums.length < 3) return null;
  const channel = (v: string) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v) / 255);
  const alpha = nums[3] === undefined ? 1 : nums[3].endsWith("%") ? parseFloat(nums[3]) / 100 : parseFloat(nums[3]);
  const rgb = nums.slice(0, 3).map(channel) as Rgb;
  return rgb.some(Number.isNaN) ? null : { rgb, alpha: Number.isNaN(alpha) ? 1 : alpha, kind: "rgb" };
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function toLch([r, g, b]: Rgb): Lch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** Linear sRGB of an OKLCH color (may be out of gamut). */
function lchToLinear({ L, C, h }: Lch): Rgb {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Back to sRGB, lowering chroma until the color fits the sRGB gamut. */
function fromLch(color: Lch): Rgb {
  const fits = (c: number) => lchToLinear({ ...color, C: c }).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let C = color.C;
  if (!fits(C)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  return lchToLinear({ ...color, C }).map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb;
}

function formatColor({ rgb, alpha, kind }: Parsed): string {
  const slash = alpha < 1 ? ` / ${+alpha.toFixed(3)}` : "";
  if (kind === "oklch") {
    const { L, C, h } = toLch(rgb.map((v) => Math.min(1, Math.max(0, v))) as Rgb);
    const hue = C < 0.0005 ? 0 : +h.toFixed(1);
    return `oklch(${+L.toFixed(3)} ${+C.toFixed(3)} ${hue}${slash})`;
  }
  if (kind === "hsl") {
    const { h, s, l } = rgbToHsl(rgb.map((v) => Math.min(1, Math.max(0, v))) as Rgb);
    return `hsl(${+h.toFixed(1)} ${+(s * 100).toFixed(1)}% ${+(l * 100).toFixed(1)}%${slash})`;
  }
  const bytes = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  if (kind === "rgb") return alpha < 1 ? `rgba(${bytes.join(", ")}, ${+alpha.toFixed(3)})` : `rgb(${bytes.join(", ")})`;
  const hex = bytes.map((v) => v.toString(16).padStart(2, "0")).join("");
  return kind === "hex8" ? `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : `#${hex}`;
}

const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function firstColor(value: string): Parsed | null {
  const match = value.match(COLOR_RE);
  return match ? parseColor(match[0]) : null;
}

/** A plain opaque color, or null for gradients, shadows and translucent values. */
export function plainColor(value: string | undefined): Rgb | null {
  const v = value?.trim();
  const c = v ? firstColor(v) : null;
  return c && c.alpha === 1 && v?.match(COLOR_RE)?.[0] === v ? c.rgb : null;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A ratio for people: truncated, so 4.49 reads 4.4 and never "4.5:1, under 4.5:1". */
export const formatRatio = (ratio: number) => (Math.floor(ratio * 10) / 10).toFixed(1);

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Perceptual distance (OKLab × 100), the same scale as the guardian's status-confusable. */
function deltaE(a: Rgb, b: Rgb): number {
  const [p, q] = [toLch(a), toLch(b)];
  const ab = (c: Lch): [number, number] => [c.C * Math.cos((c.h * Math.PI) / 180), c.C * Math.sin((c.h * Math.PI) / 180)];
  const [[a1, b1], [a2, b2]] = [ab(p), ab(q)];
  return Math.hypot(p.L - q.L, a1 - a2, b1 - b2) * 100;
}

export function anchorLch(raw: PaletteBase): Lch | null {
  const base = asFunctions(raw);
  const token = base.tokens.find((t) => t.name === base.anchor);
  const first = base.themes[0]?.name;
  const value = token ? ((first && token.values[first]) || Object.values(token.values)[0]) : undefined;
  const color = value ? firstColor(value) : null;
  return color ? toLch(color.rgb) : null;
}

// ---- What the base can do ---------------------------------------------------------------------

const isNeutralRole = (role?: string) => !!role && /^(surface|text|border)\b/.test(role);
const isRadius = (t: PaletteBase["tokens"][number]) => t.role === "radius";
const CONTROL_NAME = /^--(size-control|control-height|size-row|row-height)$/;
const isControl = (t: PaletteBase["tokens"][number]) => CONTROL_NAME.test(t.name);

function px(value: string): number | null {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem)$/);
  return m ? Number(m[1]) * (m[2] === "rem" ? 16 : 1) : null;
}

/** The base radius: the token named --radius, else the median of the non-full radius tokens. */
function baseRadius(base: PaletteBase): number | null {
  const theme = base.themes[0]?.name;
  const of = (t: PaletteBase["tokens"][number]) => px((theme && t.values[theme]) ?? Object.values(t.values)[0] ?? "");
  const named = base.tokens.find((t) => t.name === "--radius" && isRadius(t));
  const own = named ? of(named) : null;
  if (own && own > 0) return own;
  const all = base.tokens.filter(isRadius).map(of).filter((v): v is number => v !== null && v > 0 && v < 999).sort((a, b) => a - b);
  return all.length ? all[Math.floor(all.length / 2)]! : null;
}

/** Which controls this project's tokens can take, why not when they cannot, and today's value in px. */
export function capabilities(base: PaletteBase) {
  const neutrals = base.tokens.some((t) => isNeutralRole(t.role));
  const radius = baseRadius(base);
  const controlToken = base.tokens.find(isControl);
  const control = controlToken ? px(Object.values(controlToken.values)[0] ?? "") : null;
  return {
    tint: { ok: neutrals, why: neutrals ? "" : "Tu sistema no tiene tokens de superficie, texto o borde." },
    radius: { ok: radius !== null, why: radius !== null ? "" : "Tu sistema no tiene tokens de radio (o todos son 0).", now: radius },
    control: { ok: !!controlToken, why: controlToken ? "" : "Tu sistema no tiene un token de alto de controles (--size-control).", now: control },
  };
}

// ---- From a choice to token values -------------------------------------------------------------

/** Radix's tinted-gray chroma at a lightness: interpolated over the light and dark scales. */
function grayChroma(L: number): number {
  const pts = [...RADIX_GRAYS.light.L.map((l, i) => [l, RADIX_GRAYS.light.C[i]!]), ...RADIX_GRAYS.dark.L.map((l, i) => [l, RADIX_GRAYS.dark.C[i]!])].sort(
    (a, b) => a[0]! - b[0]!,
  ) as [number, number][];
  if (L <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [l1, c1] = pts[i - 1]!;
    const [l2, c2] = pts[i]!;
    if (L <= l2) return l2 === l1 ? c2 : c1 + ((c2 - c1) * (L - l1)) / (l2 - l1);
  }
  return pts[pts.length - 1]![1];
}

/**
 * New token values for a choice: the brand family (colors near the brand hue) and the neutrals
 * tinted with it follow the hue; the neutrals take Radix's tint; radii scale to the new base;
 * controls take the new height; texts reach the contrast level. Other hues (a secondary accent,
 * status colors), white and black are kept. Only the values that change are returned.
 */
export function computeDesign(base: PaletteBase, choice: DesignChoice): TokenValues {
  return asWritten(base, computeOn(asFunctions(base), choice));
}

// ---- shadcn/ui's bare HSL channels (B-038) ------------------------------------------------------
// "222.2 47.4% 11.2%" is read as hsl(222.2 47.4% 11.2%) and written back as channels, since the
// project uses it as hsl(var(--x)).

const CHANNELS = "hsl-channels";
const channelTokens = (base: PaletteBase) => new Set(base.tokens.filter((t) => t.format === CHANNELS).map((t) => t.name));
const wrap = (v: string) => (/^hsla?\(/.test(v.trim()) ? v.trim() : `hsl(${v.trim()})`);
const unwrap = (v: string) => v.trim().replace(/^hsla?\((.*)\)$/, "$1");

function mapValues(values: TokenValues, names: Set<string>, fn: (v: string) => string): TokenValues {
  const out: TokenValues = {};
  for (const [name, perTheme] of Object.entries(values))
    out[name] = names.has(name) ? Object.fromEntries(Object.entries(perTheme).map(([th, v]) => [th, fn(v)])) : perTheme;
  return out;
}

/** The base with channel tokens as hsl() values, so every color reads the same way. */
function asFunctions(base: PaletteBase): PaletteBase {
  const names = channelTokens(base);
  if (!names.size) return base;
  return { ...base, tokens: base.tokens.map((t) => (names.has(t.name) ? { ...t, values: Object.fromEntries(Object.entries(t.values).map(([th, v]) => [th, wrap(v)])) } : t)) };
}
const asWritten = (base: PaletteBase, values: TokenValues) => mapValues(values, channelTokens(base), unwrap);

/** A token's value as a CSS color, for a swatch: bare channels become hsl(). */
export function cssColorOf(base: PaletteBase, name: string, value: string | undefined): string | undefined {
  return value !== undefined && channelTokens(base).has(name) ? wrap(value) : value;
}
const asRead = (base: PaletteBase, values: TokenValues) => mapValues(values, channelTokens(base), wrap);

/** Indigo step 9 of Radix, the lightness and chroma a gray brand takes with the hue slider. */
let indigo9: Lch | null = null;

function computeOn(base: PaletteBase, choice: DesignChoice): TokenValues {
  const anchor = anchorLch(base);
  const out: TokenValues = {};
  const original = (name: string, theme: string) => base.tokens.find((t) => t.name === name)?.values[theme];
  const valueOf = (name: string, theme: string) => out[name]?.[theme] ?? original(name, theme);
  const set = (name: string, theme: string, value: string) => {
    if (value === original(name, theme)) {
      if (out[name]) delete out[name][theme];
    } else (out[name] ??= {})[theme] = value;
  };
  const defaultTheme = base.themes[0]?.name;

  for (const token of base.tokens) {
    if (token.role?.startsWith("status") || isRadius(token) || isControl(token)) continue;
    const neutral = isNeutralRole(token.role);
    for (const [theme, value] of Object.entries(token.values)) {
      let next = value.replace(COLOR_RE, (match) => {
        const color = parseColor(match);
        if (!color) return match;
        const lch = toLch(color.rgb);
        // Neutrals with a tint: Radix's tinted-gray chroma at that lightness, with the brand's hue.
        if (choice.tint !== null && neutral && lch.C < 0.04) {
          const h = choice.hue ?? anchor?.h ?? 0;
          return formatColor({ ...color, rgb: fromLch({ L: lch.L, C: choice.tint * grayChroma(lch.L), h }) });
        }
        if (choice.hue === null || !anchor || lch.C < 0.005 || hueDistance(lch.h, anchor.h) > 40) return match;
        const k = lch.C >= 0.04 ? choice.brand : 1;
        return formatColor({ ...color, rgb: fromLch({ L: lch.L, C: lch.C * k, h: (lch.h + choice.hue - anchor.h + 360) % 360 }) });
      });
      if (choice.base && token.name === base.anchor && theme === defaultTheme) next = choice.base;
      set(token.name, theme, next);
    }
  }

  // A brand with no color (shadcn/ui's default) has no hue to move: a color choice paints it, in
  // every theme, with the preset's own color (Radix step 9) or the developer's (B-038).
  const anchorToken = base.tokens.find((t) => t.name === base.anchor);
  if (choice.hue !== null && anchor && anchor.C < 0.04 && choice.brand >= 0.5 && anchorToken) {
    const own = parseColor(choice.base ?? choice.seed ?? "");
    indigo9 ??= toLch(parseColor("#3e63dd")!.rgb);
    const paint = own ? toLch(own.rgb) : { ...indigo9, h: choice.hue };
    for (const theme of Object.keys(anchorToken.values)) {
      const kind = firstColor(original(anchorToken.name, theme) ?? "")?.kind ?? "hex";
      set(anchorToken.name, theme, formatColor({ rgb: fromLch(paint), alpha: 1, kind }));
    }
  }

  const from = baseRadius(base);
  if (choice.radius !== null && from) {
    for (const t of base.tokens.filter(isRadius))
      for (const [theme, value] of Object.entries(t.values)) {
        const v = px(value);
        if (v === null || v >= 999) continue;
        set(t.name, theme, `${Math.round((v * choice.radius) / from)}px`);
      }
  }

  if (choice.control !== null) for (const t of base.tokens.filter(isControl)) for (const theme of Object.keys(t.values)) set(t.name, theme, `${choice.control}px`);

  if (choice.contrast) {
    const target = WCAG_MIN[choice.contrast];
    for (const theme of base.themes.map((t) => t.name)) {
      const grounds = base.tokens.filter((t) => t.role?.startsWith("surface")).map((t) => plainColor(valueOf(t.name, theme))).filter((c): c is Rgb => !!c);
      if (!grounds.length) continue;
      const dark = grounds.reduce((s, g) => s + luminance(g), 0) / grounds.length < 0.4;
      for (const t of base.tokens.filter((x) => x.role?.startsWith("text"))) {
        const value = valueOf(t.name, theme);
        const fg = plainColor(value);
        if (!fg || !value) continue;
        const worst = (rgb: Rgb) => Math.min(...grounds.map((g) => contrastRatio(rgb, g)));
        if (worst(fg) >= target) continue;
        const lch = toLch(fg);
        const kind = firstColor(value)?.kind ?? "hex";
        // The value as it will be written (8 bits per channel), so the check is on what ships.
        const written = (L: number) => formatColor({ rgb: fromLch({ ...lch, L }), alpha: 1, kind });
        const passes = (L: number) => worst(plainColor(written(L))!) >= target;
        // The least change in lightness that reaches the target: darker on light surfaces.
        let lo = dark ? lch.L : 0;
        let hi = dark ? 1 : lch.L;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          const ok = passes(mid);
          if (dark) ok ? (hi = mid) : (lo = mid);
          else ok ? (lo = mid) : (hi = mid);
        }
        let L = dark ? hi : lo;
        for (let i = 0; i < 50 && !passes(L); i++) L += dark ? 0.002 : -0.002;
        set(t.name, theme, written(L));
      }
    }
  }

  for (const name of Object.keys(out)) if (!Object.keys(out[name]!).length) delete out[name];
  return out;
}

/** A short name for the combination, for the proposal: "Índigo · radio 12px · contraste alto". */
export function describeChoice(choice: DesignChoice): string {
  const parts = [choice.hue !== null ? choice.name : null];
  if (choice.tint !== null) parts.push(choice.tint === 0 ? "gris puro" : choice.tint >= 1 ? "gris teñido" : `gris teñido ${Math.round(choice.tint * 100)}%`);
  if (choice.radius !== null) parts.push(`radio ${choice.radius}px`);
  if (choice.control !== null) parts.push(`controles ${choice.control}px`);
  if (choice.contrast) parts.push(choice.contrast === "AAA" ? "contraste alto" : "contraste estándar");
  return parts.filter(Boolean).join(" · ").slice(0, 60) || "Original";
}

/** The developer's own color as a choice: its hue and how much chroma it has next to the brand. */
export function customChoice(base: PaletteBase, hex: string, from: DesignChoice = ORIGINAL): DesignChoice | null {
  const color = parseColor(hex);
  const anchor = anchorLch(base);
  if (!color || !anchor) return null;
  const lch = toLch(color.rgb);
  const ratio = anchor.C > 0 ? Math.min(1.5, Math.max(0.05, lch.C / anchor.C)) : 1;
  return { ...from, id: "custom", name: `Tu color ${hex}`, hue: lch.h, brand: ratio, base: hex.toLowerCase() };
}

/**
 * The preview: one rule per theme, scoped to the theme's own selector. A token that changes in one
 * theme is written in every theme (its own value where it does not change): an !important value on
 * :root alone would beat the project's own dark-theme declaration and leak into it.
 */
export function paletteCss(base: PaletteBase, values: TokenValues): string {
  const own = (name: string, theme: string) => base.tokens.find((t) => t.name === name)?.values[theme];
  return base.themes
    .map((theme) => {
      const decls = Object.entries(values)
        .map(([name, perTheme]) => [name, perTheme[theme.name] ?? own(name, theme.name)] as const)
        .filter(([, value]) => value)
        .map(([name, value]) => `${name}: ${value} !important;`)
        .join(" ");
      return decls ? `${theme.selector} { ${decls} }` : "";
    })
    .filter(Boolean)
    .join("\n");
}

// ---- What the choice would break ----------------------------------------------------------------

export interface Pair {
  theme: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  kind: "text" | "brand" | "border" | "onBrand";
  /**
   * White reaches more contrast on this background than black: its relative luminance is under
   * 0.179, where (L + 0.05) / 0.05 = 1.05 / (L + 0.05) in WCAG's formula. The way out is a light text.
   */
  lightWins: boolean;
}

/** The text drawn on the brand (buttons): --on-primary, --color-on-primary, --primary-foreground, or the only on-accent token. */
function onBrandTokens(base: PaletteBase): string[] {
  const all = base.tokens.filter((t) => t.role === "on-accent").map((t) => t.name);
  const named = all.filter((n) => n.replace("-on-", "-") === base.anchor || n.replace(/-foreground$/, "") === base.anchor);
  return named.length ? named : all.length === 1 ? all : [];
}

/**
 * Every text, brand-as-text and control-border pair against every surface, and the text on the
 * brand against the brand, per theme.
 */
export function contrastPairs(raw: PaletteBase, written: TokenValues, level: "AA" | "AAA" = "AA"): Pair[] {
  const base = asFunctions(raw);
  const values = asRead(raw, written);
  const valueOf = (name: string, theme: string) => values[name]?.[theme] ?? base.tokens.find((t) => t.name === name)?.values[theme];
  const surfaces = base.tokens.filter((t) => t.role?.startsWith("surface")).map((t) => t.name);
  const fgs: { name: string; kind: Pair["kind"]; min: number }[] = [
    ...base.tokens.filter((t) => t.role?.startsWith("text")).map((t) => ({ name: t.name, kind: "text" as const, min: WCAG_MIN[level] })),
    { name: base.anchor, kind: "brand" as const, min: WCAG_MIN.AA },
    ...base.tokens.filter((t) => t.role?.startsWith("border") && /strong|control|input/.test(t.name)).map((t) => ({ name: t.name, kind: "border" as const, min: WCAG_MIN.nonText })),
  ];
  const out: Pair[] = [];
  const pair = (theme: string, fgName: string, bgName: string, min: number, kind: Pair["kind"]) => {
    const fg = plainColor(valueOf(fgName, theme));
    const bg = plainColor(valueOf(bgName, theme));
    if (fg && bg) out.push({ theme, fg: fgName, bg: bgName, ratio: Math.round(contrastRatio(fg, bg) * 100) / 100, min, kind, lightWins: luminance(bg) < 0.179 });
  };
  for (const theme of base.themes.map((t) => t.name)) {
    for (const f of fgs) for (const s of surfaces) pair(theme, f.name, s, f.min, f.kind);
    for (const name of onBrandTokens(base)) pair(theme, name, base.anchor, WCAG_MIN.AA, "onBrand");
  }
  return out;
}

export interface Conflict {
  kind: "status" | "literal" | "contrast";
  text: string;
  fix: string;
}

const FIX: Record<Pair["kind"], string> = {
  text: "subí el contraste a Estándar o Alto: oscurece (o aclara en oscuro) solo los textos que no llegan.",
  brand: "un tono más oscuro de la marca para el texto, o enlaces con el color de texto y subrayado.",
  border: "el borde de los controles necesita 3:1 (WCAG 1.4.11): un gris un paso más oscuro, o dejar el tinte como estaba.",
  onBrand: "el texto de los botones necesita 4.5:1 sobre la marca (WCAG 1.4.3): un tono más oscuro de la marca, o un texto oscuro sobre ella.",
};

/**
 * What a choice would break, each with a way out: hand-written colors (often status chips) it
 * would be confused with, hand-written brand colors it would leave behind, and contrast pairs
 * that stop passing. Only problems the choice introduces are listed.
 */
export function designConflicts(raw: PaletteBase, choice: DesignChoice | null, safe: string[]): Conflict[] {
  if (!choice) return [];
  const base = asFunctions(raw);
  const values = asRead(raw, computeDesign(raw, choice));
  const anchor = anchorLch(base);
  const out: Conflict[] = [];
  const brandColors = (vals: TokenValues) =>
    base.tokens
      .filter((t) => t.role?.startsWith("accent"))
      .flatMap((t) => Object.entries(t.values).map(([theme, v]) => ({ token: t.name, rgb: plainColor(vals[t.name]?.[theme] ?? v) })))
      .filter((c): c is { token: string; rgb: Rgb } => !!c.rgb);
  const before = brandColors({});
  const after = brandColors(values);
  const others = safe.filter((name) => name !== choice.name);
  const elsewhere = others.length ? `otra familia sin conflictos (${others.join(", ")})` : "otra familia";
  const behind: string[] = [];
  if (choice.hue !== null)
    for (const ref of base.references ?? []) {
      for (const value of ref.values) {
        const rgb = plainColor(value);
        if (!rgb) continue;
        const lch = toLch(rgb);
        if (anchor && lch.C >= 0.01 && hueDistance(lch.h, anchor.h) <= 40) behind.push(`${ref.where} (${value})`);
        const close = after.map((c) => ({ ...c, d: deltaE(rgb, c.rgb) })).sort((x, y) => x.d - y.d)[0];
        const wasClose = before.some((c) => deltaE(rgb, c.rgb) < STATUS_MIN_DELTA_E);
        if (close && close.d < STATUS_MIN_DELTA_E && !wasClose) {
          out.push({
            kind: "status",
            text: `${ref.where} (${value}) se confunde con ${close.token} (ΔE ${close.d.toFixed(1)}; mínimo ${STATUS_MIN_DELTA_E}).`,
            fix: `elegí ${elsewhere}, o si preferís esta, que ese estado no dependa solo del color: ícono y texto (WCAG 1.4.1).`,
          });
          break;
        }
      }
    }
  if (behind.length) {
    out.push({
      kind: "literal",
      text: `${behind.length} colores escritos a mano no siguen la paleta y quedan con el color anterior: ${behind.slice(0, 3).join(", ")}${behind.length > 3 ? ` y ${behind.length - 3} más` : ""}.`,
      fix: "convertirlos en tokens con /facha-ui:init colors (por ejemplo, un --brand-hover derivado de --brand), así siguen cualquier paleta.",
    });
  }
  // Pairs that pass today and would not with the choice (measured at the level it asks for), one
  // line per token and theme: its lowest surface, and how many more it fails on.
  const level = choice.contrast ?? "AA";
  const key = (p: Pair) => `${p.theme}|${p.fg}|${p.bg}`;
  const was = new Map(contrastPairs(base, {}, level).map((p) => [key(p), p]));
  const broken = new Map<string, Pair[]>();
  for (const p of contrastPairs(base, values, level)) {
    const prev = was.get(key(p));
    if (p.ratio < p.min && (!prev || prev.ratio >= p.min)) broken.set(`${p.theme}|${p.fg}`, [...(broken.get(`${p.theme}|${p.fg}`) ?? []), p]);
  }
  for (const pairs of [...broken.values()].slice(0, 4)) {
    const p = pairs.reduce((low, x) => (x.ratio < low.ratio ? x : low));
    const more = pairs.length > 1 ? `; también sobre ${pairs.length - 1} ${pairs.length > 2 ? "superficies más" : "superficie más"}` : "";
    // Text on the brand: light or dark text, by which one the brand lets reach more contrast.
    const fix =
      p.kind === "onBrand"
        ? `el texto de los botones necesita ${WCAG_MIN.AA}:1 sobre la marca (WCAG 1.4.3): ${p.lightWins ? "un texto claro (blanco) sobre ella, o un tono más oscuro de la marca" : "un texto oscuro sobre ella, o un tono más claro de la marca"}.`
        : FIX[p.kind];
    out.push({ kind: "contrast", text: `En ${p.theme}, ${p.fg} sobre ${p.bg} baja a ${formatRatio(p.ratio)}:1 (mínimo ${p.min}:1)${more}.`, fix });
  }
  return out;
}
